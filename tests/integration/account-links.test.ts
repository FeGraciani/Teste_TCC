import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createAdmin as createAdminUseCase, createProfessional } from "@/modules/administration/application/administration-service";
import {
  completeAccountLink,
  inspectAccountLink,
  requestPasswordReset,
  sendAccessLinkByAdmin,
} from "@/modules/identity/application/account-access-service";
import { authenticate } from "@/modules/identity/application/auth-service";
import { ValidationError } from "@/shared/errors";
import { db } from "@/shared/infrastructure/database/client";
import { accountTokens, auditLogs, sessions, users } from "@/shared/infrastructure/database/schema";
import { clearOutbox, readOutbox } from "@/shared/infrastructure/email/mailer";
import { createAdmin, createPatient, resetDatabase } from "../support/factories";

/** Último e-mail enviado para um endereço, e o token do link que ele contém. */
function lastEmailTo(address: string) {
  const email = [...readOutbox()].reverse().find((item) => item.to === address);
  const token = email?.text.match(/definir-senha\?token=([\w-]+)/)?.[1] ?? null;
  return { email, token };
}

const professionalInput = (email: string) => ({
  name: "Helena Duarte Ribeiro",
  displayName: "Dra. Helena Duarte",
  email,
  specialty: "PSYCHIATRY",
  title: "Psiquiatra",
  registry: "CRM-SP 000101",
  bio: "",
  focusAreas: "",
});

describe("convites e nova senha por e-mail: a administração nunca define nem vê senhas", () => {
  beforeEach(async () => {
    await resetDatabase();
    clearOutbox();
  });

  it("profissional cadastrado recebe convite; ninguém entra antes de ele criar a própria senha", async () => {
    const admin = await createAdmin();
    // Mesmo que alguém tente mandar uma senha no cadastro, ela é ignorada.
    const { userId, invite } = await createProfessional(admin, { ...professionalInput("helena@clinica.example"), password: "SenhaDaAdmin1" });

    expect(invite).toMatchObject({ purpose: "INVITE", maskedEmail: "h•••••@clinica.example", emailStatus: "dev-preview" });
    expect(JSON.stringify(invite)).not.toMatch(/token|senha/i);
    expect(await authenticate("helena@clinica.example", "SenhaDaAdmin1", "10.1.0.1", "PROFESSIONAL")).toEqual({ ok: false, reason: "INVALID" });

    const [pending] = await db.select({ passwordSetAt: users.passwordSetAt }).from(users).where(eq(users.id, userId));
    expect(pending!.passwordSetAt).toBeNull();

    const { email, token } = lastEmailTo("helena@clinica.example");
    expect(email?.subject).toContain("crie sua senha");
    expect(token).toBeTruthy();
    // O banco guarda só o hash do token.
    const stored = await db.select({ tokenHash: accountTokens.tokenHash }).from(accountTokens).where(eq(accountTokens.userId, userId));
    expect(stored).toHaveLength(1);
    expect(stored[0]!.tokenHash).not.toBe(token);

    expect(await inspectAccountLink(token)).toMatchObject({ status: "valid", purpose: "INVITE", firstName: "Helena", role: "PROFESSIONAL" });
    await expect(completeAccountLink(token!, { password: "MinhaSenha2030", passwordConfirmation: "Outra2030" }, null)).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(await completeAccountLink(token!, { password: "MinhaSenha2030", passwordConfirmation: "MinhaSenha2030" }, null)).toEqual({
      role: "PROFESSIONAL",
      purpose: "INVITE",
    });
    expect(await authenticate("helena@clinica.example", "MinhaSenha2030", "10.1.0.1", "PROFESSIONAL")).toMatchObject({ ok: true });

    // Uso único.
    expect(await inspectAccountLink(token)).toMatchObject({ status: "used" });
    await expect(completeAccountLink(token!, { password: "OutraSenha2030", passwordConfirmation: "OutraSenha2030" }, null)).rejects.toThrow(
      /já foi usado/,
    );
  });

  it("administração pede nova senha para um paciente: o link vai só para o paciente, e a senha atual vale até ele trocar", async () => {
    const admin = await createAdmin();
    const patient = await createPatient();
    await db.insert(sessions).values({ tokenHash: "sessao-aberta", userId: patient.userId, expiresAt: new Date(Date.now() + 3_600_000) });

    const sent = await sendAccessLinkByAdmin(admin, patient.userId);
    expect(sent).toMatchObject({ purpose: "PASSWORD_RESET", emailStatus: "dev-preview", devPreviewUrl: null });
    expect(await authenticate(patient.email, patient.password, "10.1.0.2")).toMatchObject({ ok: true }); // nada mudou ainda

    const { token } = lastEmailTo(patient.email);
    await completeAccountLink(token!, { password: "NovaSenha2031", passwordConfirmation: "NovaSenha2031" }, null);

    expect(await authenticate(patient.email, patient.password, "10.1.0.2")).toEqual({ ok: false, reason: "INVALID" });
    expect(await authenticate(patient.email, "NovaSenha2031", "10.1.0.2")).toMatchObject({ ok: true });
    expect(await db.select().from(sessions).where(eq(sessions.userId, patient.userId))).toHaveLength(0);
    expect(lastEmailTo(patient.email).email?.subject).toBe("Sua senha do Alento foi alterada");

    const actions = (await db.select({ action: auditLogs.action }).from(auditLogs)).map((row) => row.action);
    expect(actions).toEqual(expect.arrayContaining(["USER_ACCESS_LINK_SENT", "AUTH_PASSWORD_RESET_COMPLETED"]));
  });

  it("esqueci minha senha: mesma resposta para quem existe e quem não existe, com limite de envios", async () => {
    const patient = await createPatient();

    await requestPasswordReset("ninguem@teste.example", "10.1.0.3");
    expect(readOutbox()).toHaveLength(0);

    for (let attempt = 0; attempt < 5; attempt += 1) await requestPasswordReset(patient.email.toUpperCase(), "10.1.0.3");
    const sent = readOutbox().filter((item) => item.to === patient.email);
    expect(sent).toHaveLength(3); // limite por e-mail: 3 por hora

    // Só o link mais recente vale.
    const tokens = sent.map((item) => item.text.match(/token=([\w-]+)/)![1]!);
    expect(await inspectAccountLink(tokens[0])).toMatchObject({ status: "invalid" });
    expect(await inspectAccountLink(tokens[2])).toMatchObject({ status: "valid", purpose: "PASSWORD_RESET" });
  });

  it("link expirado não serve, e conta desativada não recebe link", async () => {
    const admin = await createAdmin();
    const patient = await createPatient();
    const past = new Date(Date.now() - 3 * 60 * 60 * 1000);
    await sendAccessLinkByAdmin(admin, patient.userId, past);
    const { token } = lastEmailTo(patient.email);
    expect(await inspectAccountLink(token)).toMatchObject({ status: "expired" });
    await expect(completeAccountLink(token!, { password: "NovaSenha2031", passwordConfirmation: "NovaSenha2031" }, null)).rejects.toThrow(/expirou/);

    await db.update(users).set({ active: false }).where(eq(users.id, patient.userId));
    await expect(sendAccessLinkByAdmin(admin, patient.userId)).rejects.toBeInstanceOf(ValidationError);
  });

  it("nova conta da administração também entra só pelo convite", async () => {
    const admin = await createAdmin();
    const { invite } = await createAdminUseCase(admin, { name: "Recepção da Clínica", email: "recepcao@clinica.example", password: "Conhecida1" });
    expect(invite.purpose).toBe("INVITE");
    expect(await authenticate("recepcao@clinica.example", "Conhecida1", "10.1.0.4", "ADMIN")).toEqual({ ok: false, reason: "INVALID" });
  });

  it("limite de login por conta vale mesmo trocando de IP a cada tentativa; a nova senha pelo e-mail libera", async () => {
    const patient = await createPatient();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await authenticate(patient.email, "SenhaErrada1", `203.0.113.${attempt}`);
    }
    expect(await authenticate(patient.email, patient.password, "198.51.100.7")).toEqual({ ok: false, reason: "RATE_LIMITED" });

    await requestPasswordReset(patient.email, "198.51.100.7");
    const { token } = lastEmailTo(patient.email);
    await completeAccountLink(token!, { password: "Recuperada2030", passwordConfirmation: "Recuperada2030" }, null);
    expect(await authenticate(patient.email, "Recuperada2030", "198.51.100.7")).toMatchObject({ ok: true });
  });
});
