import "server-only";
import { eq } from "drizzle-orm";
import { CLINIC_TIME_ZONE } from "@/config/clinic";
import { recordAudit } from "@/modules/audit/application/audit-service";
import type { PatientPersonalData } from "@/modules/privacy/domain/projection";
import { generatePseudonym } from "@/modules/privacy/domain/pseudonym";
import { todayKey } from "@/modules/scheduling/domain/availability";
import { assertPatient, type Actor } from "@/shared/application/actor";
import { NotFoundError, ValidationError } from "@/shared/errors";
import { decryptJson, encryptJson } from "@/shared/infrastructure/crypto";
import { db, type Executor } from "@/shared/infrastructure/database/client";
import { zodFieldErrors } from "@/shared/lib/validation";
import { patientProfileSchema, SENSITIVE_KEYS, type SensitiveData } from "../domain/patient-profile";
import { patientProfiles, users } from "../infrastructure/schema";

/** Dados completos do paciente — só saem daqui para o próprio paciente ou para a projeção de privacidade. */
export async function loadPatientPersonalData(patientId: string, executor: Executor = db): Promise<PatientPersonalData | null> {
  const [row] = await executor
    .select({ profile: patientProfiles, name: users.name, email: users.email })
    .from(patientProfiles)
    .innerJoin(users, eq(users.id, patientProfiles.userId))
    .where(eq(patientProfiles.id, patientId))
    .limit(1);
  if (!row) return null;

  const sensitive = decryptJson<SensitiveData>(row.profile.sensitiveData) ?? {};
  return {
    fullName: row.name,
    preferredName: row.profile.preferredName,
    pseudonym: row.profile.pseudonym,
    email: row.email,
    birthDate: row.profile.birthDate,
    gender: row.profile.gender,
    pronouns: row.profile.pronouns,
    phone: row.profile.phone,
    city: row.profile.city,
    state: row.profile.state,
    occupation: row.profile.occupation,
    maritalStatus: row.profile.maritalStatus,
    cpf: sensitive.cpf ?? null,
    address: sensitive.address ?? null,
    emergencyContact: sensitive.emergencyContact ?? null,
    mainComplaint: sensitive.mainComplaint ?? null,
    medications: sensitive.medications ?? null,
    allergies: sensitive.allergies ?? null,
    healthHistory: sensitive.healthHistory ?? null,
  };
}

export async function getOwnProfile(actor: Actor): Promise<PatientPersonalData> {
  const patient = assertPatient(actor);
  const data = await loadPatientPersonalData(patient.patientId);
  if (!data) throw new NotFoundError("Perfil não encontrado.");
  return data;
}

export async function updateOwnProfile(actor: Actor, raw: Record<string, unknown>): Promise<void> {
  const patient = assertPatient(actor);
  const parsed = patientProfileSchema(todayKey(CLINIC_TIME_ZONE)).safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError("Revise os campos destacados.", zodFieldErrors(parsed.error));
  }
  const input = parsed.data;
  const sensitive: SensitiveData = {};
  for (const key of SENSITIVE_KEYS) sensitive[key] = input[key];
  if (sensitive.cpf) sensitive.cpf = sensitive.cpf.replace(/\D/g, "");

  await db.transaction(async (tx) => {
    await tx.update(users).set({ name: input.name }).where(eq(users.id, patient.userId));
    await tx
      .update(patientProfiles)
      .set({
        preferredName: input.preferredName,
        birthDate: input.birthDate,
        gender: input.gender,
        pronouns: input.pronouns,
        phone: input.phone,
        city: input.city,
        state: input.state?.toUpperCase() ?? null,
        occupation: input.occupation,
        maritalStatus: input.maritalStatus,
        sensitiveData: encryptJson(sensitive),
      })
      .where(eq(patientProfiles.id, patient.patientId));
    await recordAudit({ actor, action: "PATIENT_PROFILE_UPDATED", subjectPatientId: patient.patientId }, tx);
  });
}

/** Gera um codinome ainda não usado por nenhum paciente. */
export async function createUniquePseudonym(executor: Executor = db): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = generatePseudonym(Math.random, attempt);
    const [taken] = await executor.select({ id: patientProfiles.id }).from(patientProfiles).where(eq(patientProfiles.pseudonym, candidate)).limit(1);
    if (!taken) return candidate;
  }
  throw new Error("Não foi possível gerar um codinome único.");
}

export async function regenerateOwnPseudonym(actor: Actor): Promise<string> {
  const patient = assertPatient(actor);
  const pseudonym = await createUniquePseudonym();
  await db.update(patientProfiles).set({ pseudonym }).where(eq(patientProfiles.id, patient.patientId));
  await recordAudit({ actor, action: "PATIENT_PSEUDONYM_CHANGED", subjectPatientId: patient.patientId });
  return pseudonym;
}
