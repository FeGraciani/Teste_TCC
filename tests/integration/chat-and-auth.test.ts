import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { authenticate, changePassword } from "@/modules/identity/application/auth-service";
import {
  conversationWith,
  countUnreadMessages,
  listConversations,
  listMessagesSince,
  openConversation,
  sendMessage,
} from "@/modules/messaging/application/chat-service";
import { postSystemMessage } from "@/modules/messaging/application/system-messages";
import { bookAppointment } from "@/modules/scheduling/application/booking-service";
import { ForbiddenError, NotFoundError, ValidationError } from "@/shared/errors";
import { db } from "@/shared/infrastructure/database/client";
import { auditLogs } from "@/shared/infrastructure/database/schema";
import { NOW, createAdmin, createPatient, createProfessional, createService, firstFreeSlot, resetDatabase } from "../support/factories";

describe("chat entre paciente e profissional (com banco de dados real)", () => {
  beforeEach(resetDatabase);

  it("a conversa nasce no agendamento, só os participantes acessam e as não lidas são contadas", async () => {
    const service = await createService({ specialty: "PSYCHOLOGY" });
    const professional = await createProfessional({ specialty: "PSYCHOLOGY" });
    const patient = await createPatient();
    const stranger = await createPatient();
    const startsAt = await firstFreeSlot(professional.professionalId, service.id);
    await bookAppointment(patient, { professionalId: professional.professionalId, serviceId: service.id, startsAt, modality: "ONLINE" }, NOW);

    const [conversation] = await listConversations(patient);
    expect(conversation).toBeDefined();
    expect(await countUnreadMessages(professional)).toBe(1); // aviso automático do agendamento

    await expect(openConversation(stranger, conversation!.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(conversationWith(stranger, professional.professionalId)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(sendMessage(await createAdmin(), { conversationId: conversation!.id, body: "Oi" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(sendMessage(patient, { conversationId: conversation!.id, body: "   " })).rejects.toBeInstanceOf(ValidationError);

    await sendMessage(patient, { conversationId: conversation!.id, body: "Vou atrasar 10 minutos, tudo bem?" });
    expect(await countUnreadMessages(professional)).toBe(2);
    expect(await countUnreadMessages(patient)).toBe(0);

    const opened = await openConversation(professional, conversation!.id);
    expect(opened.messages.at(-1)).toMatchObject({ kind: "USER", body: "Vou atrasar 10 minutos, tudo bem?", mine: false });
    expect(await countUnreadMessages(professional)).toBe(0);
  });

  it("aviso automático gravado numa transação demorada não se perde na atualização do chat", async () => {
    const service = await createService({ specialty: "PSYCHOLOGY" });
    const professional = await createProfessional({ specialty: "PSYCHOLOGY" });
    const patient = await createPatient();
    const startsAt = await firstFreeSlot(professional.professionalId, service.id);
    await bookAppointment(patient, { professionalId: professional.professionalId, serviceId: service.id, startsAt, modality: "ONLINE" }, NOW);
    const [conversation] = await listConversations(patient);

    // O navegador já viu uma mensagem mais nova que o aviso (o aviso só "apareceu" no banco depois).
    const seen = await sendMessage(professional, { conversationId: conversation!.id, body: "Bom dia!" });
    await db.transaction(async (tx) => {
      await postSystemMessage(tx, {
        patientId: patient.patientId,
        professionalId: professional.professionalId,
        triggeredByUserId: professional.userId,
        text: "Aviso que demorou a ser gravado.",
      });
      await tx.execute(
        sql`update messages set created_at = now() - interval '30 seconds' where body_encrypted is not null and kind = 'SYSTEM' and created_at > now() - interval '1 second'`,
      );
    });

    const polled = await listMessagesSince(patient, conversation!.id, new Date(seen.createdAt));
    expect(polled.map((message) => message.body)).toContain("Aviso que demorou a ser gravado.");
  });
});

describe("entrada nos portais (com banco de dados real)", () => {
  beforeEach(resetDatabase);

  it("credenciais certas no portal errado não abrem sessão; senha errada é recusada e auditada", async () => {
    const professional = await createProfessional({ specialty: "PSYCHIATRY" });

    expect(await authenticate(professional.email, professional.password, "10.0.0.1", "PROFESSIONAL")).toMatchObject({
      ok: true,
      role: "PROFESSIONAL",
    });
    expect(await authenticate(professional.email, professional.password, "10.0.0.1", "PATIENT")).toEqual({
      ok: false,
      reason: "WRONG_PORTAL",
      role: "PROFESSIONAL",
    });
    expect(await authenticate(professional.email, "SenhaErrada1", "10.0.0.1", "PROFESSIONAL")).toEqual({ ok: false, reason: "INVALID" });

    const failures = await db.select().from(auditLogs).where(eq(auditLogs.action, "AUTH_LOGIN_FAILED"));
    expect(failures).toHaveLength(1);
  });

  it("bloqueia tentativas repetidas por 15 minutos", async () => {
    const patient = await createPatient();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(await authenticate(patient.email, "SenhaErrada1", "10.0.0.2")).toEqual({ ok: false, reason: "INVALID" });
    }
    expect(await authenticate(patient.email, patient.password, "10.0.0.2")).toEqual({ ok: false, reason: "RATE_LIMITED" });
  });

  it("troca de senha exige a senha atual", async () => {
    const patient = await createPatient();
    await expect(
      changePassword(patient, { currentPassword: "Errada123", newPassword: "NovaSenha2030", newPasswordConfirmation: "NovaSenha2030" }, null),
    ).rejects.toBeInstanceOf(ValidationError);
    await changePassword(
      patient,
      { currentPassword: patient.password, newPassword: "NovaSenha2030", newPasswordConfirmation: "NovaSenha2030" },
      null,
    );
    expect(await authenticate(patient.email, "NovaSenha2030", "10.0.0.3")).toMatchObject({ ok: true });
  });
});
