import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { CLINIC_TIME_ZONE } from "@/config/clinic";
import { recordAudit } from "@/modules/audit/application/audit-service";
import { createDefaultPolicy } from "@/modules/privacy/application/policy-store";
import { NAMED_PRESET_KEYS, type NamedPresetKey } from "@/modules/privacy/domain/privacy-fields";
import { todayKey } from "@/modules/scheduling/domain/availability";
import type { Actor } from "@/shared/application/actor";
import { ValidationError } from "@/shared/errors";
import { db } from "@/shared/infrastructure/database/client";
import { trySendEmail } from "@/shared/infrastructure/email/mailer";
import { parseOrThrow } from "@/shared/lib/validation";
import { firstNameOf } from "../domain/account-links";
import { DUMMY_PASSWORD_HASH, hashPassword, passwordProblem, verifyPassword } from "../domain/password";
import { birthDateSchema, fullNameSchema } from "../domain/patient-profile";
import type { Role } from "../domain/roles";
import { patientProfiles, users } from "../infrastructure/schema";
import { passwordChangedEmail } from "./account-emails";
import { createUniquePseudonym } from "./patient-profile-service";
import { LOGIN_ACCOUNT_LIMIT, LOGIN_LIMIT, clearFailures, isRateLimited, loginKeys, registerFailure } from "./rate-limit";
import { destroyOtherSessionsOf } from "./session";

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido.").max(160, "E-mail longo demais."));

export const passwordSchema = z.string().superRefine((value, context) => {
  const problem = passwordProblem(value);
  if (problem) context.addIssue({ code: "custom", message: problem });
});

export type AuthResult =
  | { ok: true; userId: string; role: Role }
  | { ok: false; reason: "INVALID" | "INACTIVE" | "RATE_LIMITED" }
  | { ok: false; reason: "WRONG_PORTAL"; role: Role };

/**
 * Verifica credenciais com proteção contra força bruta e enumeração de e-mails.
 * @param expectedRole perfil do portal usado (paciente, profissional ou administração).
 *                     Credenciais certas no portal errado não abrem sessão.
 */
export async function authenticate(rawEmail: string, password: string, ip: string | null, expectedRole?: Role): Promise<AuthResult> {
  const email = rawEmail.trim().toLowerCase();
  // Dois limites: por e-mail + IP e por conta (este último vale mesmo que o IP mude a cada tentativa).
  const keys = loginKeys(email, ip);
  if (isRateLimited(keys.pair, LOGIN_LIMIT) || isRateLimited(keys.account, LOGIN_ACCOUNT_LIMIT)) return { ok: false, reason: "RATE_LIMITED" };

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  // Sempre calcula um hash, exista ou não o usuário, para o tempo de resposta não revelar e-mails cadastrados.
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

  if (!user || !valid) {
    registerFailure(keys.pair, LOGIN_LIMIT);
    registerFailure(keys.account, LOGIN_ACCOUNT_LIMIT);
    await recordAudit({
      action: "AUTH_LOGIN_FAILED",
      entityType: "user",
      entityId: user?.id,
      metadata: { reason: user ? "wrong_password" : "unknown_email" },
      ip,
    });
    return { ok: false, reason: "INVALID" };
  }
  if (!user.active) return { ok: false, reason: "INACTIVE" };

  clearFailures(keys.pair);
  clearFailures(keys.account);
  if (expectedRole && user.role !== expectedRole) return { ok: false, reason: "WRONG_PORTAL", role: user.role };

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await recordAudit({
    actor: { role: user.role, userId: user.id },
    action: "AUTH_LOGIN",
    entityType: "user",
    entityId: user.id,
    ip,
  });
  return { ok: true, userId: user.id, role: user.role };
}

function signUpSchema() {
  return z
    .object({
      name: fullNameSchema,
      email: emailSchema,
      password: passwordSchema,
      passwordConfirmation: z.string(),
      birthDate: birthDateSchema(todayKey(CLINIC_TIME_ZONE)),
      privacyPreset: z.enum(NAMED_PRESET_KEYS as [NamedPresetKey, ...NamedPresetKey[]], { error: "Escolha como quer ser identificado." }),
      acceptTerms: z.literal("on", { error: "Você precisa concordar com os termos para continuar." }),
    })
    .refine((data) => data.password === data.passwordConfirmation, {
      path: ["passwordConfirmation"],
      message: "As senhas não conferem.",
    });
}

export type SignUpInput = Record<string, unknown>;

/** Cria a conta do paciente, o perfil, o codinome e a política de privacidade inicial. */
export async function registerPatient(raw: SignUpInput, ip: string | null): Promise<{ userId: string }> {
  const input = parseOrThrow(signUpSchema(), raw);

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
  if (existing) {
    throw new ValidationError("Revise os campos destacados.", { email: ["Já existe uma conta com este e-mail. Tente entrar."] });
  }

  const passwordHash = await hashPassword(input.password);
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ email: input.email, name: input.name, passwordHash, passwordSetAt: new Date(), role: "PATIENT" })
      .returning({ id: users.id });
    const pseudonym = await createUniquePseudonym(tx);
    const [profile] = await tx
      .insert(patientProfiles)
      .values({ userId: user.id, pseudonym, birthDate: input.birthDate })
      .returning({ id: patientProfiles.id });
    await createDefaultPolicy(tx, profile.id, input.privacyPreset);
    await recordAudit(
      {
        actor: { role: "PATIENT", userId: user.id },
        action: "AUTH_SIGNUP",
        subjectPatientId: profile.id,
        metadata: { privacyPreset: input.privacyPreset },
        ip,
      },
      tx,
    );
    return { userId: user.id };
  });
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe sua senha atual."),
    newPassword: passwordSchema,
    newPasswordConfirmation: z.string(),
  })
  .refine((data) => data.newPassword === data.newPasswordConfirmation, {
    path: ["newPasswordConfirmation"],
    message: "As senhas não conferem.",
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    path: ["newPassword"],
    message: "A nova senha precisa ser diferente da atual.",
  });

/**
 * Troca a senha de qualquer perfil, sabendo a senha atual. Encerra as outras
 * sessões abertas e avisa o dono da conta por e-mail.
 * @param keepSessionTokenHash sessão que continua válida (padrão: a do cookie atual).
 */
export async function changePassword(actor: Actor, raw: Record<string, unknown>, keepSessionTokenHash?: string | null): Promise<void> {
  const input = parseOrThrow(changePasswordSchema, raw);
  const [user] = await db
    .select({ passwordHash: users.passwordHash, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, actor.userId))
    .limit(1);
  if (!user || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw new ValidationError("Revise os campos destacados.", { currentPassword: ["Senha atual incorreta."] });
  }

  const passwordHash = await hashPassword(input.newPassword);
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash, passwordSetAt: now }).where(eq(users.id, actor.userId));
    await recordAudit({ actor, action: "AUTH_PASSWORD_CHANGED", entityType: "user", entityId: actor.userId }, tx);
  });
  await destroyOtherSessionsOf(actor.userId, keepSessionTokenHash);
  // Aviso de segurança para o dono da conta (se não foi ele, sabe na hora).
  await trySendEmail(passwordChangedEmail({ to: user.email, firstName: firstNameOf(user.name), when: now }));
}
