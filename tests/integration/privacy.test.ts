import { beforeEach, describe, expect, it } from "vitest";
import { listConversations, openConversation } from "@/modules/messaging/application/chat-service";
import {
  getPatientProfileForProfessional,
  getPrivacyOverview,
  requestFieldAccess,
  resolveDisplayNames,
  respondToAccessRequest,
  revokeFieldGrants,
  savePrivacySettings,
} from "@/modules/privacy/application/privacy-service";
import { eq } from "drizzle-orm";
import { db } from "@/shared/infrastructure/database/client";
import { privacyPolicies } from "@/shared/infrastructure/database/schema";
import { NotFoundError } from "@/shared/errors";
import { fieldsForPreset } from "@/modules/privacy/domain/privacy-fields";
import { isValidPseudonym } from "@/modules/privacy/domain/pseudonym";
import { listProfessionalAgenda, listProfessionalPatients } from "@/modules/scheduling/application/agenda-service";
import { bookAppointment } from "@/modules/scheduling/application/booking-service";
import { ForbiddenError } from "@/shared/errors";
import { NOW, createPatient, createProfessional, createService, firstFreeSlot, resetDatabase } from "../support/factories";

const valueOf = (profile: Awaited<ReturnType<typeof getPatientProfileForProfessional>>, key: string) =>
  profile.view.fields.find((field) => field.key === key)!.value;

/** Agenda com o profissional; `skip` evita que o mesmo paciente caia em dois horários iguais. */
async function bookWith(professional: { professionalId: string }, patient: Parameters<typeof bookAppointment>[0], serviceId: string, skip = 0) {
  const startsAt = await firstFreeSlot(professional.professionalId, serviceId, skip);
  return bookAppointment(patient, { professionalId: professional.professionalId, serviceId, startsAt, modality: "ONLINE" }, NOW);
}

describe("anonimato configurável (com banco de dados real)", () => {
  beforeEach(resetDatabase);

  it("profissional sem consulta com o paciente não acessa nada dele", async () => {
    const professional = await createProfessional({ specialty: "PSYCHOLOGY" });
    const patient = await createPatient({ preset: "IDENTIFIED" });
    await expect(getPatientProfileForProfessional(professional, patient.patientId)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("modo anônimo: nome, documento e contato nunca chegam ao profissional (ficha, agenda, lista e chat)", async () => {
    const service = await createService({ specialty: "PSYCHOLOGY" });
    const professional = await createProfessional({ specialty: "PSYCHOLOGY" });
    const patient = await createPatient({
      name: "Joana Prado Siqueira",
      preset: "ANONYMOUS",
      profile: { cpf: "123.456.789-09", phone: "(11) 91234-5678", address: "Rua Secreta, 10", occupation: "Cientista" },
    });
    await bookWith(professional, patient, service.id);

    const profile = await getPatientProfileForProfessional(professional, patient.patientId);
    const agenda = await listProfessionalAgenda(professional, { scope: "upcoming" }, NOW);
    const patients = await listProfessionalPatients(professional, NOW);
    const conversations = await listConversations(professional);
    const conversation = await openConversation(professional, conversations[0]!.id);

    expect(isValidPseudonym(profile.view.displayName)).toBe(true);
    expect(agenda[0]!.patient.displayName).toBe(profile.view.displayName);
    expect(conversation.counterpart.name).toBe(profile.view.displayName);

    const everythingTheProfessionalReceived = JSON.stringify({ profile, agenda, patients, conversations, conversation });
    for (const secret of ["Joana", "Prado", "Siqueira", "123.456.789", "12345678909", "91234", "Rua Secreta", "Cientista", patient.email]) {
      expect(everythingTheProfessionalReceived).not.toContain(secret);
    }
  });

  it("exceção por profissional: só a psiquiatra escolhida vê o nome completo", async () => {
    const psychology = await createService({ specialty: "PSYCHOLOGY" });
    const psychiatry = await createService({ specialty: "PSYCHIATRY", durationMinutes: 30 });
    const psychologist = await createProfessional({ specialty: "PSYCHOLOGY" });
    const psychiatrist = await createProfessional({ specialty: "PSYCHIATRY" });
    const patient = await createPatient({ name: "Mariana Souza de Oliveira", preset: "ANONYMOUS" });
    await bookWith(psychologist, patient, psychology.id);
    await bookWith(psychiatrist, patient, psychiatry.id, 4);

    await savePrivacySettings(patient, {
      professionalId: psychiatrist.professionalId,
      fields: { ...fieldsForPreset("ANONYMOUS"), name: "FULL" },
    });

    const seenByPsychiatrist = await getPatientProfileForProfessional(psychiatrist, patient.patientId);
    const seenByPsychologist = await getPatientProfileForProfessional(psychologist, patient.patientId);
    expect(seenByPsychiatrist.view.displayName).toBe("Mariana Souza de Oliveira");
    expect(seenByPsychiatrist.policySource).toBe("override");
    expect(isValidPseudonym(seenByPsychologist.view.displayName)).toBe(true);
    expect(JSON.stringify(seenByPsychologist)).not.toContain("Mariana");
  });

  it("pedido de acesso: libera só os dados pedidos, só para quem pediu, e só se o paciente aprovar", async () => {
    const service = await createService({ specialty: "PSYCHIATRY", durationMinutes: 30 });
    const psychiatrist = await createProfessional({ specialty: "PSYCHIATRY" });
    const colleague = await createProfessional({ specialty: "PSYCHIATRY", displayName: "Dr. Colega" });
    const patient = await createPatient({
      preset: "DISCREET",
      profile: { cpf: "123.456.789-09", address: "Rua Secreta, 10", city: "São Paulo", state: "SP" },
    });
    await bookWith(psychiatrist, patient, service.id);
    await bookWith(colleague, patient, service.id, 4);

    expect(valueOf(await getPatientProfileForProfessional(psychiatrist, patient.patientId), "cpf")).toEqual({ status: "hidden" });

    await requestFieldAccess(psychiatrist, {
      patientId: patient.patientId,
      fields: ["cpf"],
      reason: "Preciso emitir uma receita de controle especial.",
    });
    const overview = await getPrivacyOverview(patient);
    expect(overview.pendingRequests).toHaveLength(1);
    expect(overview.pendingRequests[0]!.fieldLabels).toEqual(["CPF"]);

    // Enquanto o paciente não responde, nada muda.
    expect(valueOf(await getPatientProfileForProfessional(psychiatrist, patient.patientId), "cpf")).toEqual({ status: "hidden" });

    await respondToAccessRequest(patient, { requestId: overview.pendingRequests[0]!.id, approve: true });

    const afterApproval = await getPatientProfileForProfessional(psychiatrist, patient.patientId);
    expect(valueOf(afterApproval, "cpf")).toEqual({ status: "shown", text: "123.456.789-09" });
    expect(valueOf(afterApproval, "location")).toMatchObject({ status: "partial" }); // endereço não foi pedido
    expect(valueOf(await getPatientProfileForProfessional(colleague, patient.patientId), "cpf")).toEqual({ status: "hidden" });

    // O paciente foi avisado pelo chat e a resposta também ficou registrada lá.
    const conversations = await listConversations(patient);
    const withPsychiatrist = conversations.find((item) => item.counterpart.name === psychiatrist.displayName)!;
    const thread = await openConversation(patient, withPsychiatrist.id);
    expect(thread.messages.some((message) => message.kind === "SYSTEM" && message.body.includes("pediu para ver: CPF"))).toBe(true);
    expect(thread.messages.some((message) => message.kind === "SYSTEM" && message.body.startsWith("Pedido aprovado"))).toBe(true);
  });

  it("o paciente vê quem acessou o seu perfil", async () => {
    const service = await createService({ specialty: "PSYCHOLOGY" });
    const professional = await createProfessional({ specialty: "PSYCHOLOGY", displayName: "Ana Teste" });
    const patient = await createPatient();
    await bookWith(professional, patient, service.id);
    await getPatientProfileForProfessional(professional, patient.patientId);

    const { accessLog } = await getPrivacyOverview(patient);
    expect(accessLog).toHaveLength(1);
    expect(accessLog[0]).toMatchObject({ professionalName: "Ana Teste", sawProfile: true });
  });
});

describe("liberações por pedido: por campo, por cima da configuração e revogáveis", () => {
  beforeEach(resetDatabase);

  async function approvedRequest(fields: string[], preset: "DISCREET" | "ANONYMOUS" = "DISCREET") {
    const service = await createService({ specialty: "PSYCHIATRY", durationMinutes: 30 });
    const psychiatrist = await createProfessional({ specialty: "PSYCHIATRY" });
    const patient = await createPatient({
      name: "Beatriz Lemos Arantes",
      preset,
      profile: { cpf: "123.456.789-09", address: "Rua Secreta, 10", city: "São Paulo", state: "SP", occupation: "Arquiteta" },
    });
    await bookWith(psychiatrist, patient, service.id);
    await requestFieldAccess(psychiatrist, { patientId: patient.patientId, fields, reason: "Preciso emitir uma receita de controle especial." });
    const { pendingRequests } = await getPrivacyOverview(patient);
    await respondToAccessRequest(patient, { requestId: pendingRequests[0]!.id, approve: true });
    return { psychiatrist, patient };
  }

  it("aprovar não cria exceção congelada: se o padrão ficar mais reservado, só o que foi liberado continua visível", async () => {
    const { psychiatrist, patient } = await approvedRequest(["cpf"]);

    // Nenhuma exceção completa foi criada para o profissional.
    const policies = await db.select().from(privacyPolicies).where(eq(privacyPolicies.patientId, patient.patientId));
    expect(policies.filter((policy) => policy.professionalId !== null)).toHaveLength(0);

    const overview = await getPrivacyOverview(patient);
    expect(overview.activeGrants).toEqual([
      expect.objectContaining({ professionalId: psychiatrist.professionalId, fields: [expect.objectContaining({ key: "cpf", label: "CPF" })] }),
    ]);

    // O paciente endurece o padrão para Anônimo depois da aprovação.
    await savePrivacySettings(patient, { professionalId: null, fields: fieldsForPreset("ANONYMOUS") });
    const seen = await getPatientProfileForProfessional(psychiatrist, patient.patientId);
    expect(valueOf(seen, "cpf")).toEqual({ status: "shown", text: "123.456.789-09" });
    expect(isValidPseudonym(seen.view.displayName)).toBe(true);
    expect(valueOf(seen, "occupation")).toEqual({ status: "hidden" });
    expect(JSON.stringify(seen)).not.toContain("Arquiteta");
  });

  it("revogar devolve o dado às preferências e avisa o profissional pelo chat", async () => {
    const { psychiatrist, patient } = await approvedRequest(["cpf", "location"]);
    expect(valueOf(await getPatientProfileForProfessional(psychiatrist, patient.patientId), "location")).toMatchObject({ status: "shown" });

    expect(await revokeFieldGrants(patient, { professionalId: psychiatrist.professionalId, field: "location" })).toBe(1);
    const afterOne = await getPatientProfileForProfessional(psychiatrist, patient.patientId);
    expect(valueOf(afterOne, "location")).toMatchObject({ status: "partial" }); // volta ao padrão Discreto (só a cidade)
    expect(valueOf(afterOne, "cpf")).toMatchObject({ status: "shown" });

    expect(await revokeFieldGrants(patient, { professionalId: psychiatrist.professionalId })).toBe(1);
    expect(valueOf(await getPatientProfileForProfessional(psychiatrist, patient.patientId), "cpf")).toEqual({ status: "hidden" });
    await expect(revokeFieldGrants(patient, { professionalId: psychiatrist.professionalId })).rejects.toBeInstanceOf(NotFoundError);

    const [conversation] = await listConversations(psychiatrist);
    const thread = await openConversation(psychiatrist, conversation!.id);
    expect(thread.messages.some((message) => message.kind === "SYSTEM" && message.body.startsWith("Liberação revogada pelo paciente"))).toBe(true);
  });

  it("nome liberado por pedido aparece também nas listas (agenda, chat)", async () => {
    const { psychiatrist, patient } = await approvedRequest(["name"], "ANONYMOUS");
    const names = await resolveDisplayNames(psychiatrist.professionalId, [patient.patientId]);
    expect(names.get(patient.patientId)?.displayName).toBe("Beatriz Lemos Arantes");

    await revokeFieldGrants(patient, { professionalId: psychiatrist.professionalId, field: "name" });
    const after = await resolveDisplayNames(psychiatrist.professionalId, [patient.patientId]);
    expect(isValidPseudonym(after.get(patient.patientId)!.displayName)).toBe(true);
  });

  it("um paciente não revoga liberações de outro", async () => {
    const { psychiatrist } = await approvedRequest(["cpf"]);
    const intruder = await createPatient();
    await expect(revokeFieldGrants(intruder, { professionalId: psychiatrist.professionalId })).rejects.toBeInstanceOf(NotFoundError);
  });
});
