import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { updateProfessional } from "@/modules/administration/application/administration-service";
import { addClinicalRecord, getPatientChart } from "@/modules/clinical-records/application/records-service";
import { bookAppointment, cancelAppointment } from "@/modules/scheduling/application/booking-service";
import { ForbiddenError, ValidationError } from "@/shared/errors";
import { db } from "@/shared/infrastructure/database/client";
import { NOW, createAdmin, createPatient, createProfessional, createService, firstFreeSlot, resetDatabase } from "../support/factories";

async function book(professional: { professionalId: string }, patient: Parameters<typeof bookAppointment>[0], serviceId: string, skip = 0) {
  const startsAt = await firstFreeSlot(professional.professionalId, serviceId, skip);
  return bookAppointment(patient, { professionalId: professional.professionalId, serviceId, startsAt, modality: "ONLINE" }, NOW);
}

describe("prontuário (com banco de dados real)", () => {
  beforeEach(resetDatabase);

  it("o próximo profissional lê o que é da equipe; restrições e anotações pessoais ficam de fora", async () => {
    const psychology = await createService({ specialty: "PSYCHOLOGY" });
    const psychiatry = await createService({ specialty: "PSYCHIATRY", durationMinutes: 30 });
    const psychologist = await createProfessional({ specialty: "PSYCHOLOGY" });
    const psychiatrist = await createProfessional({ specialty: "PSYCHIATRY" });
    const patient = await createPatient();
    await book(psychologist, patient, psychology.id);

    await addClinicalRecord(psychologist, {
      patientId: patient.patientId,
      type: "HANDOFF",
      visibility: "CARE_TEAM",
      content: "Nota de passagem para o próximo profissional.",
    });
    await addClinicalRecord(psychologist, {
      patientId: patient.patientId,
      type: "EVOLUTION",
      visibility: "SAME_SPECIALTY",
      content: "Registro técnico de psicoterapia.",
    });
    await addClinicalRecord(psychologist, {
      patientId: patient.patientId,
      type: "NOTE",
      visibility: "AUTHOR_ONLY",
      content: "Anotação pessoal da psicóloga.",
    });

    // Antes de ter consulta, a psiquiatra não acessa nada.
    await expect(getPatientChart(psychiatrist, patient.patientId)).rejects.toBeInstanceOf(ForbiddenError);

    await book(psychiatrist, patient, psychiatry.id, 4);
    const chart = await getPatientChart(psychiatrist, patient.patientId);
    expect(chart.handoffs.map((entry) => entry.content)).toEqual(["Nota de passagem para o próximo profissional."]);
    expect(chart.entries).toHaveLength(0);
    expect(chart.restrictedCount).toBe(2);

    // A autora continua vendo tudo o que escreveu.
    const ownChart = await getPatientChart(psychologist, patient.patientId);
    expect(ownChart.handoffs.length + ownChart.entries.length).toBe(3);
  });

  it("paciente e administração nunca leem o prontuário", async () => {
    const service = await createService({ specialty: "PSYCHOLOGY" });
    const professional = await createProfessional({ specialty: "PSYCHOLOGY" });
    const patient = await createPatient();
    await book(professional, patient, service.id);
    await addClinicalRecord(professional, {
      patientId: patient.patientId,
      type: "EVOLUTION",
      visibility: "CARE_TEAM",
      content: "Conteúdo clínico sigiloso.",
    });

    await expect(getPatientChart(patient, patient.patientId)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getPatientChart(await createAdmin(), patient.patientId)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("consulta cancelada não cria vínculo para ler o prontuário", async () => {
    const service = await createService({ specialty: "PSYCHOLOGY" });
    const professional = await createProfessional({ specialty: "PSYCHOLOGY" });
    const patient = await createPatient();
    const { appointmentId } = await book(professional, patient, service.id);
    await cancelAppointment(professional, { appointmentId, reason: "Imprevisto de agenda." }, NOW);
    await expect(getPatientChart(professional, patient.patientId)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("psicólogo não registra conduta medicamentosa", async () => {
    const service = await createService({ specialty: "PSYCHOLOGY" });
    const professional = await createProfessional({ specialty: "PSYCHOLOGY" });
    const patient = await createPatient();
    await book(professional, patient, service.id);
    await expect(
      addClinicalRecord(professional, {
        patientId: patient.patientId,
        type: "PRESCRIPTION",
        visibility: "CARE_TEAM",
        content: "Prescrição indevida.",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("o conteúdo fica criptografado no banco e o próprio banco impede alterar ou apagar registros", async () => {
    const service = await createService({ specialty: "PSYCHOLOGY" });
    const professional = await createProfessional({ specialty: "PSYCHOLOGY" });
    const patient = await createPatient();
    await book(professional, patient, service.id);
    const { id } = await addClinicalRecord(professional, {
      patientId: patient.patientId,
      type: "EVOLUTION",
      visibility: "CARE_TEAM",
      content: "Relata insônia há três semanas.",
    });

    const raw = await db.execute<{ content_encrypted: string }>(sql`select content_encrypted from clinical_records where id = ${id}`);
    expect(raw.rows[0]!.content_encrypted.startsWith("v1.")).toBe(true);
    expect(raw.rows[0]!.content_encrypted).not.toContain("insônia");

    await expect(db.execute(sql`update clinical_records set content_encrypted = 'adulterado' where id = ${id}`)).rejects.toThrow();
    await expect(db.execute(sql`update clinical_records set author_specialty = 'PSYCHIATRY' where id = ${id}`)).rejects.toThrow();
    await expect(db.execute(sql`delete from clinical_records where id = ${id}`)).rejects.toThrow();
    // Nem esvaziar a tabela inteira (TRUNCATE), direto ou em cascata.
    const blockedByDatabase = (error: unknown) => /não pode ser esvaziado/.test(String((error as { cause?: Error }).cause?.message ?? error));
    await expect(db.execute(sql`truncate table clinical_records`)).rejects.toSatisfy(blockedByDatabase);
    await expect(db.execute(sql`truncate table patient_profiles cascade`)).rejects.toSatisfy(blockedByDatabase);
    const still = await db.execute<{ total: string }>(sql`select count(*)::text as total from clinical_records`);
    expect(still.rows[0]!.total).toBe("1");
  });

  it("a regra “só minha especialidade” usa a especialidade de quando o registro foi escrito", async () => {
    const psychology = await createService({ specialty: "PSYCHOLOGY" });
    const psychiatry = await createService({ specialty: "PSYCHIATRY", durationMinutes: 30 });
    const author = await createProfessional({ specialty: "PSYCHIATRY", displayName: "Dr. Autor" });
    const psychologist = await createProfessional({ specialty: "PSYCHOLOGY" });
    const otherPsychiatrist = await createProfessional({ specialty: "PSYCHIATRY", displayName: "Dra. Colega" });
    const patient = await createPatient();
    await book(author, patient, psychiatry.id);
    await book(psychologist, patient, psychology.id, 4);
    await book(otherPsychiatrist, patient, psychiatry.id, 12);
    await addClinicalRecord(author, {
      patientId: patient.patientId,
      type: "PRESCRIPTION",
      visibility: "SAME_SPECIALTY",
      content: "Conduta técnica psiquiátrica.",
    });

    // A administração corrige o cadastro do autor para Psicologia depois do registro.
    await updateProfessional(await createAdmin(), author.professionalId, {
      name: "Autor da Silva",
      displayName: "Dr. Autor",
      email: author.email,
      specialty: "PSYCHOLOGY",
      title: "Psicólogo",
      registry: "CRP 06/000111",
      bio: "",
      focusAreas: "",
    });

    expect((await getPatientChart(otherPsychiatrist, patient.patientId)).entries.map((entry) => entry.content)).toEqual([
      "Conduta técnica psiquiátrica.",
    ]);
    expect((await getPatientChart(psychologist, patient.patientId)).entries).toHaveLength(0);
  });
});
