import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { recordAudit } from "@/modules/audit/application/audit-service";
import { assertCareRelationship } from "@/modules/scheduling/application/care-relationship";
import { assertProfessional, type Actor } from "@/shared/application/actor";
import { NotFoundError, ValidationError } from "@/shared/errors";
import { decrypt, encrypt } from "@/shared/infrastructure/crypto";
import { db } from "@/shared/infrastructure/database/client";
import { appointments, professionalProfiles } from "@/shared/infrastructure/database/schema";
import { parseOrThrow } from "@/shared/lib/validation";
import {
  RECORD_MAX_LENGTH,
  RECORD_MIN_LENGTH,
  RECORD_TYPES,
  canReadRecord,
  recordTypesFor,
  type RecordType,
  type RecordVisibility,
  type Specialty,
} from "../domain/record-access";
import { clinicalRecords } from "../infrastructure/schema";

export type ChartEntry = {
  id: string;
  type: RecordType;
  typeLabel: string;
  visibility: RecordVisibility;
  content: string;
  createdAt: Date;
  appointmentId: string | null;
  author: { id: string; displayName: string; title: string; specialty: Specialty; isMe: boolean };
};

export type PatientChart = {
  /** Notas de passagem de caso, fixadas no topo para o próximo profissional. */
  handoffs: ChartEntry[];
  entries: ChartEntry[];
  /** Registros de outros profissionais restritos a eles (não exibidos). */
  restrictedCount: number;
};

/**
 * Prontuário visto por um profissional com vínculo de cuidado.
 * NÃO existe caminho equivalente para pacientes ou para a administração.
 * Cada leitura é registrada na trilha de auditoria.
 */
export async function getPatientChart(actor: Actor, patientId: string): Promise<PatientChart> {
  const professional = assertProfessional(actor);
  await assertCareRelationship(professional.professionalId, patientId);

  const rows = await db
    .select({
      record: clinicalRecords,
      authorName: professionalProfiles.displayName,
      authorTitle: professionalProfiles.title,
    })
    .from(clinicalRecords)
    .innerJoin(professionalProfiles, eq(professionalProfiles.id, clinicalRecords.authorId))
    .where(eq(clinicalRecords.patientId, patientId))
    .orderBy(desc(clinicalRecords.createdAt));

  const viewer = { professionalId: professional.professionalId, specialty: professional.specialty };
  // A especialidade usada é a gravada no registro (a do autor quando escreveu), não o cadastro atual.
  const readable = rows.filter((row) =>
    canReadRecord({ authorId: row.record.authorId, authorSpecialty: row.record.authorSpecialty, visibility: row.record.visibility }, viewer),
  );

  const entries: ChartEntry[] = readable.map((row) => ({
    id: row.record.id,
    type: row.record.type,
    typeLabel: RECORD_TYPES[row.record.type].label,
    visibility: row.record.visibility,
    content: decrypt(row.record.contentEncrypted),
    createdAt: row.record.createdAt,
    appointmentId: row.record.appointmentId,
    author: {
      id: row.record.authorId,
      displayName: row.authorName,
      title: row.authorTitle,
      specialty: row.record.authorSpecialty,
      isMe: row.record.authorId === professional.professionalId,
    },
  }));

  await recordAudit({
    actor,
    action: "CLINICAL_RECORDS_VIEWED",
    subjectPatientId: patientId,
    entityType: "clinical_record",
    metadata: { readable: entries.length },
  });

  return {
    handoffs: entries.filter((entry) => entry.type === "HANDOFF"),
    entries: entries.filter((entry) => entry.type !== "HANDOFF"),
    restrictedCount: rows.length - readable.length,
  };
}

const recordSchema = z.object({
  patientId: z.uuid(),
  type: z.enum(["ANAMNESIS", "EVOLUTION", "HANDOFF", "PRESCRIPTION", "REFERRAL", "NOTE"], { error: "Escolha o tipo de registro." }),
  visibility: z.enum(["CARE_TEAM", "SAME_SPECIALTY", "AUTHOR_ONLY"], { error: "Escolha quem pode ler." }),
  appointmentId: z
    .string()
    .optional()
    .transform((value) => (value ? value : null))
    .pipe(z.uuid().nullable()),
  content: z
    .string()
    .trim()
    .min(RECORD_MIN_LENGTH, `Escreva ao menos ${RECORD_MIN_LENGTH} caracteres.`)
    .max(RECORD_MAX_LENGTH, `Use no máximo ${RECORD_MAX_LENGTH} caracteres.`),
});

/** Nova anotação. Registros são imutáveis — correções viram uma nova anotação. */
export async function addClinicalRecord(actor: Actor, raw: Record<string, unknown>): Promise<{ id: string }> {
  const professional = assertProfessional(actor);
  const input = parseOrThrow(recordSchema, raw);
  await assertCareRelationship(professional.professionalId, input.patientId);

  if (!recordTypesFor(professional.specialty).includes(input.type)) {
    throw new ValidationError("Esse tipo de registro não se aplica à sua especialidade.", { type: ["Tipo não permitido."] });
  }

  if (input.appointmentId) {
    const [appointment] = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.id, input.appointmentId),
          eq(appointments.patientId, input.patientId),
          eq(appointments.professionalId, professional.professionalId),
        ),
      )
      .limit(1);
    if (!appointment) throw new NotFoundError("Consulta não encontrada para este paciente.");
  }

  const [created] = await db
    .insert(clinicalRecords)
    .values({
      patientId: input.patientId,
      authorId: professional.professionalId,
      authorSpecialty: professional.specialty,
      appointmentId: input.appointmentId,
      type: input.type,
      visibility: input.visibility,
      contentEncrypted: encrypt(input.content),
    })
    .returning({ id: clinicalRecords.id });

  await recordAudit({
    actor,
    action: "CLINICAL_RECORD_CREATED",
    subjectPatientId: input.patientId,
    entityType: "clinical_record",
    entityId: created.id,
    metadata: { type: input.type, visibility: input.visibility },
  });
  return created;
}
