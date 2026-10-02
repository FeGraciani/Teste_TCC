import "server-only";
import { and, asc, eq, gt, lt } from "drizzle-orm";
import { z } from "zod";
import { CLINIC_TIME_ZONE } from "@/config/clinic";
import { recordAudit } from "@/modules/audit/application/audit-service";
import { assertProfessional, type Actor } from "@/shared/application/actor";
import { NotFoundError, ValidationError } from "@/shared/errors";
import { afterResponse } from "@/shared/infrastructure/after-response";
import { db } from "@/shared/infrastructure/database/client";
import { professionalProfiles } from "@/shared/infrastructure/database/schema";
import { isUuid, parseOrThrow } from "@/shared/lib/validation";
import { localDateTimeToInstant, type WeeklyBlock } from "../domain/availability";
import { validateWeeklyBlocks } from "../domain/weekly-schedule";
import { appointments, scheduleSettings, timeOffs, weeklyScheduleBlocks } from "../infrastructure/schema";
import { emailCancellationNotices, type CancellationNotice } from "./appointment-emails";
import { getScheduleRules, getWeeklyBlocks, type ScheduleRules } from "./availability-service";
import { cancelWithinTransaction, loadAppointmentForUpdate, lockProfessionalAgenda } from "./booking-service";

export type ScheduleConfiguration = {
  rules: ScheduleRules;
  blocks: WeeklyBlock[];
  acceptsOnline: boolean;
  acceptsInPerson: boolean;
  upcomingTimeOffs: { id: string; startsAt: Date; endsAt: Date; reason: string | null }[];
};

export async function getScheduleConfiguration(actor: Actor, now: Date = new Date()): Promise<ScheduleConfiguration> {
  const professional = assertProfessional(actor);
  const [profile] = await db
    .select({ acceptsOnline: professionalProfiles.acceptsOnline, acceptsInPerson: professionalProfiles.acceptsInPerson })
    .from(professionalProfiles)
    .where(eq(professionalProfiles.id, professional.professionalId))
    .limit(1);

  return {
    rules: await getScheduleRules(professional.professionalId),
    blocks: await getWeeklyBlocks(professional.professionalId),
    acceptsOnline: profile?.acceptsOnline ?? true,
    acceptsInPerson: profile?.acceptsInPerson ?? true,
    upcomingTimeOffs: await db
      .select({ id: timeOffs.id, startsAt: timeOffs.startsAt, endsAt: timeOffs.endsAt, reason: timeOffs.reason })
      .from(timeOffs)
      .where(and(eq(timeOffs.professionalId, professional.professionalId), gt(timeOffs.endsAt, now)))
      .orderBy(asc(timeOffs.startsAt)),
  };
}

const blockSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  startMinute: z.number().int().min(0).max(1440),
  endMinute: z.number().int().min(0).max(1440),
  kind: z.enum(["APPOINTMENTS", "INTERNAL"]),
  label: z
    .string()
    .trim()
    .max(40)
    .nullish()
    .transform((value) => (value ? value : null)),
});

/**
 * Substitui a grade semanal inteira. Consultas já marcadas NÃO são
 * afetadas — a nova grade vale para os próximos agendamentos.
 */
export async function saveWeeklySchedule(actor: Actor, raw: unknown): Promise<void> {
  const professional = assertProfessional(actor);
  const blocks = parseOrThrow(z.array(blockSchema).max(84, "Períodos demais."), raw, "A grade de horários tem dados inválidos.");
  const problems = validateWeeklyBlocks(blocks);
  if (problems.length > 0) throw new ValidationError(problems[0], { blocks: problems });

  await db.transaction(async (tx) => {
    // Mesma trava do agendamento: ninguém reserva no meio da troca da grade.
    await lockProfessionalAgenda(tx, professional.professionalId);
    await tx.delete(weeklyScheduleBlocks).where(eq(weeklyScheduleBlocks.professionalId, professional.professionalId));
    if (blocks.length > 0) {
      await tx.insert(weeklyScheduleBlocks).values(blocks.map((block) => ({ ...block, professionalId: professional.professionalId })));
    }
    await recordAudit({ actor, action: "SCHEDULE_UPDATED", entityType: "schedule", metadata: { blocks: blocks.length } }, tx);
  });
}

const settingsSchema = z
  .object({
    bufferMinutes: z.coerce.number().int().min(0, "Mínimo 0.").max(120, "Máximo 120 minutos."),
    slotStepMinutes: z.coerce
      .number()
      .int()
      .refine((value) => [15, 20, 30, 45, 60, 90].includes(value), "Escolha um intervalo da lista."),
    minNoticeHours: z.coerce.number().int().min(0).max(720, "Máximo de 30 dias."),
    bookingWindowDays: z.coerce.number().int().min(7, "Mínimo de 7 dias.").max(180, "Máximo de 180 dias."),
    acceptsOnline: z.enum(["on"]).optional(),
    acceptsInPerson: z.enum(["on"]).optional(),
  })
  .refine((data) => data.acceptsOnline || data.acceptsInPerson, {
    path: ["acceptsOnline"],
    message: "Ofereça ao menos uma modalidade de atendimento.",
  });

export async function saveScheduleSettings(actor: Actor, raw: Record<string, unknown>): Promise<void> {
  const professional = assertProfessional(actor);
  const input = parseOrThrow(settingsSchema, raw);
  const rules = {
    bufferMinutes: input.bufferMinutes,
    slotStepMinutes: input.slotStepMinutes,
    minNoticeHours: input.minNoticeHours,
    bookingWindowDays: input.bookingWindowDays,
  };

  await db.transaction(async (tx) => {
    await tx
      .insert(scheduleSettings)
      .values({ professionalId: professional.professionalId, ...rules })
      .onConflictDoUpdate({ target: scheduleSettings.professionalId, set: { ...rules, updatedAt: new Date() } });
    await tx
      .update(professionalProfiles)
      .set({ acceptsOnline: Boolean(input.acceptsOnline), acceptsInPerson: Boolean(input.acceptsInPerson) })
      .where(eq(professionalProfiles.id, professional.professionalId));
    await recordAudit({ actor, action: "SCHEDULE_SETTINGS_UPDATED", entityType: "schedule", metadata: rules }, tx);
  });
}

const timeOffSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de início."),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Informe a hora de início."),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de fim."),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Informe a hora de fim."),
  reason: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value ? value : null)),
  cancelConflicts: z.enum(["on"]).optional(),
});

/**
 * Registra uma ausência. Se houver consultas no período, pode cancelá-las
 * e avisar cada paciente pelo chat — ou apenas informar quantas existem.
 */
export async function addTimeOff(
  actor: Actor,
  raw: Record<string, unknown>,
  now: Date = new Date(),
): Promise<{ conflicts: number; cancelled: number }> {
  const professional = assertProfessional(actor);
  const input = parseOrThrow(timeOffSchema, raw);
  const startsAt = localDateTimeToInstant(input.startDate, input.startTime, CLINIC_TIME_ZONE);
  const endsAt = localDateTimeToInstant(input.endDate, input.endTime, CLINIC_TIME_ZONE);
  if (!startsAt || !endsAt) throw new ValidationError("Datas inválidas.");
  if (endsAt <= startsAt) throw new ValidationError("O fim da ausência precisa ser depois do início.", { endDate: ["Fim antes do início."] });
  if (endsAt <= now) throw new ValidationError("Essa ausência já terminou.", { endDate: ["Escolha um período futuro."] });

  const notices: CancellationNotice[] = [];
  const result = await db.transaction(async (tx) => {
    // Mesma trava do agendamento: nenhuma reserva cai dentro da ausência sem ser vista abaixo.
    await lockProfessionalAgenda(tx, professional.professionalId);
    const [created] = await tx
      .insert(timeOffs)
      .values({ professionalId: professional.professionalId, startsAt, endsAt, reason: input.reason })
      .returning({ id: timeOffs.id });

    const conflicts = await tx
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.professionalId, professional.professionalId),
          eq(appointments.status, "SCHEDULED"),
          lt(appointments.startsAt, endsAt),
          gt(appointments.endsAt, startsAt),
        ),
      );

    let cancelled = 0;
    if (input.cancelConflicts && conflicts.length > 0) {
      const reason = `ausência do profissional${input.reason ? ` (${input.reason})` : ""}`;
      for (const conflict of conflicts) {
        const loaded = await loadAppointmentForUpdate(tx, conflict.id);
        if (loaded && loaded.appointment.endsAt > now) {
          notices.push(await cancelWithinTransaction(tx, actor, loaded, reason, now));
          cancelled += 1;
        }
      }
    }

    await recordAudit(
      { actor, action: "TIME_OFF_CREATED", entityType: "time_off", entityId: created.id, metadata: { conflicts: conflicts.length, cancelled } },
      tx,
    );
    return { conflicts: conflicts.length, cancelled };
  });
  await afterResponse(() => emailCancellationNotices(notices));
  return result;
}

export async function removeTimeOff(actor: Actor, timeOffId: string): Promise<void> {
  const professional = assertProfessional(actor);
  if (!isUuid(timeOffId)) throw new NotFoundError("Ausência não encontrada.");
  const deleted = await db
    .delete(timeOffs)
    .where(and(eq(timeOffs.id, timeOffId), eq(timeOffs.professionalId, professional.professionalId)))
    .returning({ id: timeOffs.id });
  if (deleted.length === 0) throw new NotFoundError("Ausência não encontrada.");
  await recordAudit({ actor, action: "TIME_OFF_REMOVED", entityType: "time_off", entityId: timeOffId });
}
