import "server-only";
import { and, eq } from "drizzle-orm";
import { ForbiddenError } from "@/shared/errors";
import { db, type Executor } from "@/shared/infrastructure/database/client";
import { isUuid } from "@/shared/lib/validation";
import { hasCareRelationship } from "../domain/appointment-policy";
import { appointments } from "../infrastructure/schema";

/**
 * Vínculo de cuidado entre profissional e paciente (existe consulta
 * agendada, realizada ou com falta). É a porta de entrada para qualquer
 * acesso a dados do paciente, prontuário ou chat.
 */
export async function hasCareRelationshipWith(professionalId: string, patientId: string, executor: Executor = db): Promise<boolean> {
  if (!isUuid(professionalId) || !isUuid(patientId)) return false;
  const rows = await executor
    .select({ status: appointments.status })
    .from(appointments)
    .where(and(eq(appointments.professionalId, professionalId), eq(appointments.patientId, patientId)));
  return hasCareRelationship(rows.map((row) => row.status));
}

export async function assertCareRelationship(professionalId: string, patientId: string, executor: Executor = db): Promise<void> {
  if (!(await hasCareRelationshipWith(professionalId, patientId, executor))) {
    throw new ForbiddenError("Você só acessa dados de pacientes com consulta marcada ou realizada com você.");
  }
}

/** Profissionais que já atenderam ou vão atender o paciente. */
export async function careTeamOf(patientId: string, executor: Executor = db): Promise<string[]> {
  const rows = await executor
    .selectDistinct({ professionalId: appointments.professionalId, status: appointments.status })
    .from(appointments)
    .where(eq(appointments.patientId, patientId));
  const byProfessional = new Map<string, (typeof rows)[number]["status"][]>();
  for (const row of rows) byProfessional.set(row.professionalId, [...(byProfessional.get(row.professionalId) ?? []), row.status]);
  return [...byProfessional.entries()].filter(([, statuses]) => hasCareRelationship(statuses)).map(([id]) => id);
}
