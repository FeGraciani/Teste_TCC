import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { recordAudit } from "@/modules/audit/application/audit-service";
import { assertAdmin, type Actor } from "@/shared/application/actor";
import { NotFoundError, ValidationError } from "@/shared/errors";
import { randomToken, sha256 } from "@/shared/infrastructure/crypto";
import { db, type Executor } from "@/shared/infrastructure/database/client";
import { trySendEmail, type EmailDelivery } from "@/shared/infrastructure/email/mailer";
import { appUrl } from "@/shared/infrastructure/env";
import { isUuid, parseOrThrow } from "@/shared/lib/validation";
import {
  ACCOUNT_LINK_PROBLEMS,
  ACCOUNT_LINK_TTL_MS,
  accountLinkState,
  firstNameOf,
  maskEmail,
  type AccountLinkPurpose,
} from "../domain/account-links";
import { hashPassword } from "../domain/password";
import type { Role } from "../domain/roles";
import { accountTokens, sessions, users } from "../infrastructure/schema";
import { inviteEmail, passwordChangedEmail, passwordResetEmail } from "./account-emails";
import { emailSchema, passwordSchema } from "./auth-service";
import { PASSWORD_RESET_EMAIL_LIMIT, PASSWORD_RESET_IP_LIMIT, clearLoginFailuresFor, consumeRateLimit } from "./rate-limit";

/**
 * Convites e redefinição de senha por links de uso único.
 *
 * Princípio: a senha é sempre escolhida pelo DONO da conta. A administração
 * pode pedir que um link seja enviado, mas o link vai só para o e-mail da
 * pessoa — assim ninguém da clínica consegue entrar como um profissional
 * (e ler prontuários) ou como um paciente.
 */

export const ACCOUNT_LINK_PATH = "/definir-senha";

export function accountLinkUrl(token: string): string {
  return `${appUrl()}${ACCOUNT_LINK_PATH}?token=${encodeURIComponent(token)}`;
}

type LinkOwner = { id: string; email: string; name: string; role: Role };

/** Cria um link novo e invalida os anteriores ainda não usados da mesma pessoa. */
async function issueAccountLink(
  executor: Executor,
  params: { userId: string; purpose: AccountLinkPurpose; requestedByUserId: string | null; now: Date },
): Promise<{ url: string; expiresAt: Date }> {
  const token = randomToken(32);
  const expiresAt = new Date(params.now.getTime() + ACCOUNT_LINK_TTL_MS[params.purpose]);
  await executor.delete(accountTokens).where(and(eq(accountTokens.userId, params.userId), isNull(accountTokens.usedAt)));
  await executor.insert(accountTokens).values({
    userId: params.userId,
    purpose: params.purpose,
    tokenHash: sha256(token),
    expiresAt,
    requestedByUserId: params.requestedByUserId,
  });
  return { url: accountLinkUrl(token), expiresAt };
}

function linkEmail(owner: LinkOwner, purpose: AccountLinkPurpose, url: string) {
  const firstName = firstNameOf(owner.name);
  return purpose === "INVITE"
    ? inviteEmail({ to: owner.email, firstName, role: owner.role, url })
    : passwordResetEmail({ to: owner.email, firstName, url });
}

export type AccountLinkSent = {
  purpose: AccountLinkPurpose;
  maskedEmail: string;
  expiresAt: Date;
  /**
   * sent: entregue ao provedor de e-mail.
   * dev-preview: ambiente de desenvolvimento ou testes, sem SMTP (nada saiu do servidor).
   * not-sent: produção sem SMTP_URL ou falha do provedor — é preciso reenviar.
   */
  emailStatus: "sent" | "dev-preview" | "not-sent";
  /**
   * Só em desenvolvimento local sem SMTP (next dev): o link, para testar o
   * fluxo sem caixa de e-mail. Nunca existe em produção.
   */
  devPreviewUrl: string | null;
};

function describeDelivery(delivery: EmailDelivery, url: string): Pick<AccountLinkSent, "emailStatus" | "devPreviewUrl"> {
  if (delivery.delivered) return { emailStatus: "sent", devPreviewUrl: null };
  if (delivery.transport === "dev-console" || delivery.transport === "memory") {
    return { emailStatus: "dev-preview", devPreviewUrl: process.env.NODE_ENV === "development" ? url : null };
  }
  return { emailStatus: "not-sent", devPreviewUrl: null };
}

/**
 * Convite de primeiro acesso para uma conta criada pela administração.
 * Chame DEPOIS de gravar a conta (fora da transação que a cria).
 */
export async function sendInvite(actor: Actor, userId: string, now: Date = new Date()): Promise<AccountLinkSent> {
  const admin = assertAdmin(actor);
  const [owner] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!owner) throw new NotFoundError("Conta não encontrada.");

  const link = await db.transaction(async (tx) => {
    const issued = await issueAccountLink(tx, { userId: owner.id, purpose: "INVITE", requestedByUserId: admin.userId, now });
    await recordAudit({ actor, action: "USER_ACCESS_LINK_SENT", entityType: "user", entityId: owner.id, metadata: { purpose: "INVITE" } }, tx);
    return issued;
  });
  const delivery = await trySendEmail(linkEmail(owner, "INVITE", link.url));
  return { purpose: "INVITE", maskedEmail: maskEmail(owner.email), expiresAt: link.expiresAt, ...describeDelivery(delivery, link.url) };
}

/**
 * A administração pede um link de acesso para o DONO da conta (qualquer perfil).
 * Quem ainda não aceitou o convite recebe o convite de novo; quem já tem senha
 * recebe um link de redefinição — e a senha atual continua valendo até a
 * própria pessoa trocá-la. Nada é revelado à administração.
 */
export async function sendAccessLinkByAdmin(actor: Actor, userId: string, now: Date = new Date()): Promise<AccountLinkSent> {
  const admin = assertAdmin(actor);
  if (!isUuid(userId)) throw new NotFoundError("Conta não encontrada.");
  const [owner] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role, active: users.active, passwordSetAt: users.passwordSetAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!owner) throw new NotFoundError("Conta não encontrada.");
  if (!owner.active) throw new ValidationError("Este acesso está desativado. Reative-o antes de enviar um link.");

  const purpose: AccountLinkPurpose = owner.passwordSetAt ? "PASSWORD_RESET" : "INVITE";
  const link = await db.transaction(async (tx) => {
    const issued = await issueAccountLink(tx, { userId: owner.id, purpose, requestedByUserId: admin.userId, now });
    await recordAudit({ actor, action: "USER_ACCESS_LINK_SENT", entityType: "user", entityId: owner.id, metadata: { purpose } }, tx);
    return issued;
  });
  const delivery = await trySendEmail(linkEmail(owner, purpose, link.url));
  return { purpose, maskedEmail: maskEmail(owner.email), expiresAt: link.expiresAt, ...describeDelivery(delivery, link.url) };
}

/**
 * "Esqueci minha senha". Não devolve nada: a resposta para quem pediu é
 * sempre a mesma, exista ou não a conta (para não revelar quem é paciente).
 */
export async function requestPasswordReset(rawEmail: string, ip: string | null, now: Date = new Date()): Promise<void> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return;
  const email = parsed.data;
  if (!consumeRateLimit(`reset:${email}`, PASSWORD_RESET_EMAIL_LIMIT)) return;
  if (ip && !consumeRateLimit(`reset-ip:${ip}`, PASSWORD_RESET_IP_LIMIT)) return;

  const [owner] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role, active: users.active, passwordSetAt: users.passwordSetAt })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!owner || !owner.active) return;

  // Convite ainda não aceito: reenviamos o convite (o efeito é o mesmo, criar a primeira senha).
  const purpose: AccountLinkPurpose = owner.passwordSetAt ? "PASSWORD_RESET" : "INVITE";
  const link = await db.transaction(async (tx) => {
    const issued = await issueAccountLink(tx, { userId: owner.id, purpose, requestedByUserId: null, now });
    await recordAudit(
      {
        actor: { userId: owner.id, role: owner.role },
        action: "AUTH_PASSWORD_RESET_REQUESTED",
        entityType: "user",
        entityId: owner.id,
        metadata: { purpose },
        ip,
      },
      tx,
    );
    return issued;
  });
  await trySendEmail(linkEmail(owner, purpose, link.url));
}

export type AccountLinkStatus =
  | { status: "valid"; purpose: AccountLinkPurpose; firstName: string; maskedEmail: string; role: Role }
  | { status: "invalid" | "expired" | "used"; message: string };

/** O que a página do link mostra (sem consumir o link). */
export async function inspectAccountLink(token: string | null | undefined, now: Date = new Date()): Promise<AccountLinkStatus> {
  if (!token || token.length > 200) return { status: "invalid", message: ACCOUNT_LINK_PROBLEMS.invalid };
  const [row] = await db
    .select({
      purpose: accountTokens.purpose,
      expiresAt: accountTokens.expiresAt,
      usedAt: accountTokens.usedAt,
      name: users.name,
      email: users.email,
      role: users.role,
      active: users.active,
    })
    .from(accountTokens)
    .innerJoin(users, eq(users.id, accountTokens.userId))
    .where(eq(accountTokens.tokenHash, sha256(token)))
    .limit(1);
  if (!row || !row.active) return { status: "invalid", message: ACCOUNT_LINK_PROBLEMS.invalid };
  const state = accountLinkState(row, now);
  if (state !== "valid") return { status: state, message: ACCOUNT_LINK_PROBLEMS[state] };
  return { status: "valid", purpose: row.purpose, firstName: firstNameOf(row.name), maskedEmail: maskEmail(row.email), role: row.role };
}

const newPasswordSchema = z
  .object({
    password: passwordSchema,
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "As senhas não conferem.",
  });

/**
 * Define a senha a partir do link (uso único). Encerra todas as sessões
 * abertas da conta e avisa por e-mail quando foi uma redefinição.
 */
export async function completeAccountLink(
  token: string,
  raw: Record<string, unknown>,
  ip: string | null,
  now: Date = new Date(),
): Promise<{ role: Role; purpose: AccountLinkPurpose }> {
  const input = parseOrThrow(newPasswordSchema, raw);
  if (!token || token.length > 200) throw new ValidationError(ACCOUNT_LINK_PROBLEMS.invalid);
  const passwordHash = await hashPassword(input.password);

  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        tokenId: accountTokens.id,
        purpose: accountTokens.purpose,
        expiresAt: accountTokens.expiresAt,
        usedAt: accountTokens.usedAt,
        userId: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        active: users.active,
      })
      .from(accountTokens)
      .innerJoin(users, eq(users.id, accountTokens.userId))
      .where(eq(accountTokens.tokenHash, sha256(token)))
      .for("update", { of: accountTokens })
      .limit(1);
    if (!row || !row.active) throw new ValidationError(ACCOUNT_LINK_PROBLEMS.invalid);
    const state = accountLinkState(row, now);
    if (state !== "valid") throw new ValidationError(ACCOUNT_LINK_PROBLEMS[state]);

    await tx.update(users).set({ passwordHash, passwordSetAt: now }).where(eq(users.id, row.userId));
    await tx.update(accountTokens).set({ usedAt: now }).where(eq(accountTokens.id, row.tokenId));
    await tx.delete(accountTokens).where(and(eq(accountTokens.userId, row.userId), isNull(accountTokens.usedAt)));
    await tx.delete(sessions).where(eq(sessions.userId, row.userId));
    await recordAudit(
      {
        actor: { userId: row.userId, role: row.role },
        action: row.purpose === "INVITE" ? "AUTH_INVITE_ACCEPTED" : "AUTH_PASSWORD_RESET_COMPLETED",
        entityType: "user",
        entityId: row.userId,
        ip,
      },
      tx,
    );
    return row;
  });

  clearLoginFailuresFor(result.email);
  if (result.purpose === "PASSWORD_RESET") {
    await trySendEmail(passwordChangedEmail({ to: result.email, firstName: firstNameOf(result.name), when: now }));
  }
  return { role: result.role, purpose: result.purpose };
}
