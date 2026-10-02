import "server-only";
import { and, asc, eq, gt, lt } from "drizzle-orm";
import { CLINIC_TIME_ZONE } from "@/config/clinic";
import { getServiceById } from "@/modules/catalog/application/catalog-service";
import { NotFoundError, ValidationError } from "@/shared/errors";
import { db, type Executor } from "@/shared/infrastructure/database/client";
import { isUuid } from "@/shared/lib/validation";
import { professionalProfiles, users } from "@/shared/infrastructure/database/schema";
import { addDaysToKey, computeAvailableSlots, dayBounds, groupSlotsByDay, todayKey, type Slot, type WeeklyBlock } from "../domain/availability";
import { appointments, scheduleSettings, timeOffs, weeklyScheduleBlocks, type ScheduleSettingsRow } from "../infrastructure/schema";

export const DEFAULT_SCHEDULE_SETTINGS = {
  bufferMinutes: 10,
  slotStepMinutes: 60,
  minNoticeHours: 12,
  bookingWindowDays: 45,
} as const;

export type ScheduleRules = Pick<ScheduleSettingsRow, "bufferMinutes" | "slotStepMinutes" | "minNoticeHours" | "bookingWindowDays">;

export async function getScheduleRules(professionalId: string, executor: Executor = db): Promise<ScheduleRules> {
  const [row] = await executor.select().from(scheduleSettings).where(eq(scheduleSettings.professionalId, professionalId)).limit(1);
  return row ?? { ...DEFAULT_SCHEDULE_SETTINGS };
}

export async function getWeeklyBlocks(professionalId: string, executor: Executor = db): Promise<WeeklyBlock[]> {
  return executor
    .select({
      weekday: weeklyScheduleBlocks.weekday,
      startMinute: weeklyScheduleBlocks.startMinute,
      endMinute: weeklyScheduleBlocks.endMinute,
      kind: weeklyScheduleBlocks.kind,
      label: weeklyScheduleBlocks.label,
    })
    .from(weeklyScheduleBlocks)
    .where(eq(weeklyScheduleBlocks.professionalId, professionalId))
    .orderBy(asc(weeklyScheduleBlocks.weekday), asc(weeklyScheduleBlocks.startMinute));
}

export type BookableProfessional = {
  id: string;
  userActive: boolean;
  displayName: string;
  title: string;
  specialty: "PSYCHOLOGY" | "PSYCHIATRY";
  registry: string;
  acceptsOnline: boolean;
  acceptsInPerson: boolean;
};

export async function getProfessionalForBooking(professionalId: string, executor: Executor = db): Promise<BookableProfessional | null> {
  if (!isUuid(professionalId)) return null;
  const [row] = await executor
    .select({
      id: professionalProfiles.id,
      userActive: users.active,
      displayName: professionalProfiles.displayName,
      title: professionalProfiles.title,
      specialty: professionalProfiles.specialty,
      registry: professionalProfiles.registry,
      acceptsOnline: professionalProfiles.acceptsOnline,
      acceptsInPerson: professionalProfiles.acceptsInPerson,
    })
    .from(professionalProfiles)
    .innerJoin(users, eq(users.id, professionalProfiles.userId))
    .where(eq(professionalProfiles.id, professionalId))
    .limit(1);
  return row ?? null;
}

/** Calcula horários livres de um profissional para uma duração, entre duas datas civis. */
export async function computeSlots(
  executor: Executor,
  params: { professionalId: string; durationMinutes: number; fromDate: string; toDate: string; now: Date },
): Promise<Slot[]> {
  const rules = await getScheduleRules(params.professionalId, executor);
  const blocks = await getWeeklyBlocks(params.professionalId, executor);
  const start = dayBounds(params.fromDate, CLINIC_TIME_ZONE).start;
  const end = dayBounds(params.toDate, CLINIC_TIME_ZONE).end;
  // Margem para que consultas vizinhas ao intervalo também contem no intervalo entre atendimentos.
  const margin = 6 * 60 * 60 * 1000;
  const rangeStart = new Date(start.getTime() - margin);
  const rangeEnd = new Date(end.getTime() + margin);

  const busy = await executor
    .select({ start: appointments.startsAt, end: appointments.endsAt })
    .from(appointments)
    .where(
      and(
        eq(appointments.professionalId, params.professionalId),
        eq(appointments.status, "SCHEDULED"),
        lt(appointments.startsAt, rangeEnd),
        gt(appointments.endsAt, rangeStart),
      ),
    );

  const absences = await executor
    .select({ start: timeOffs.startsAt, end: timeOffs.endsAt })
    .from(timeOffs)
    .where(and(eq(timeOffs.professionalId, params.professionalId), lt(timeOffs.startsAt, rangeEnd), gt(timeOffs.endsAt, rangeStart)));

  return computeAvailableSlots({
    timeZone: CLINIC_TIME_ZONE,
    now: params.now,
    fromDate: params.fromDate,
    toDate: params.toDate,
    blocks,
    busy,
    timeOff: absences,
    rules: { ...rules, durationMinutes: params.durationMinutes },
  });
}

export type AvailabilityDay = { dateKey: string; slots: { startsAt: string; time: string }[] };

/**
 * Horários disponíveis para o paciente escolher, dentro da janela de
 * agendamento do profissional. Usado pela tela de agendamento.
 */
export async function getAvailabilityForBooking(
  params: { professionalId: string; serviceId: string },
  now: Date = new Date(),
): Promise<{ days: AvailabilityDay[]; durationMinutes: number }> {
  const professional = await getProfessionalForBooking(params.professionalId);
  if (!professional || !professional.userActive) throw new NotFoundError("Profissional indisponível.");
  const service = await getServiceById(params.serviceId);
  if (!service || !service.active) throw new NotFoundError("Serviço indisponível.");
  if (service.specialty !== professional.specialty) throw new ValidationError("Este profissional não realiza esse atendimento.");

  const rules = await getScheduleRules(professional.id);
  const fromDate = todayKey(CLINIC_TIME_ZONE, now);
  const toDate = addDaysToKey(fromDate, rules.bookingWindowDays, CLINIC_TIME_ZONE);
  const slots = await computeSlots(db, {
    professionalId: professional.id,
    durationMinutes: service.durationMinutes,
    fromDate,
    toDate,
    now,
  });

  return {
    durationMinutes: service.durationMinutes,
    days: groupSlotsByDay(slots).map((group) => ({
      dateKey: group.dateKey,
      slots: group.slots.map((slot) => ({ startsAt: slot.startsAt.toISOString(), time: slot.time })),
    })),
  };
}
