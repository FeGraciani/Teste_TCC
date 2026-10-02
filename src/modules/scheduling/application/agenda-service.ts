import "server-only";
import { and, asc, desc, eq, gt, gte, lt, ne, or } from "drizzle-orm";
import { CLINIC_TIME_ZONE } from "@/config/clinic";
import { alias } from "drizzle-orm/pg-core";
import { resolveDisplayNames, type PatientNameInfo } from "@/modules/privacy/application/privacy-service";
import { assertPatient, assertProfessional, type Actor } from "@/shared/application/actor";
import { db } from "@/shared/infrastructure/database/client";
import { professionalProfiles, services, timeOffs, users } from "@/shared/infrastructure/database/schema";
import { minutesOfDay, toDateKey } from "@/shared/lib/datetime";
import { isUuid } from "@/shared/lib/validation";
import { getWeeklyBlocks } from "./availability-service";
import {
  canJoinOnlineRoom,
  canPatientCancel,
  canProfessionalCancel,
  canRecordOutcome,
  type AppointmentStatus,
  type Modality,
} from "../domain/appointment-policy";
import { addDaysToKey, dayBounds, todayKey } from "../domain/availability";
import { appointments } from "../infrastructure/schema";

const canceller = alias(users, "canceller");

export type PatientAppointmentView = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  modality: Modality;
  priceCents: number;
  meetingUrl: string | null;
  cancellationReason: string | null;
  cancelledBy: "PATIENT" | "PROFESSIONAL" | "ADMIN" | null;
  serviceName: string;
  durationMinutes: number;
  professional: { id: string; displayName: string; title: string; specialty: "PSYCHOLOGY" | "PSYCHIATRY" };
  cancel: { allowed: boolean; reason?: string };
  canJoin: boolean;
};

export async function listPatientAppointments(
  actor: Actor,
  now: Date = new Date(),
): Promise<{ upcoming: PatientAppointmentView[]; past: PatientAppointmentView[] }> {
  const patient = assertPatient(actor);
  const rows = await db
    .select({
      appointment: appointments,
      serviceName: services.name,
      durationMinutes: services.durationMinutes,
      professional: {
        id: professionalProfiles.id,
        displayName: professionalProfiles.displayName,
        title: professionalProfiles.title,
        specialty: professionalProfiles.specialty,
      },
      cancelledByRole: canceller.role,
    })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(professionalProfiles, eq(professionalProfiles.id, appointments.professionalId))
    .leftJoin(canceller, eq(canceller.id, appointments.cancelledByUserId))
    .where(eq(appointments.patientId, patient.patientId))
    .orderBy(asc(appointments.startsAt));

  const views: PatientAppointmentView[] = rows.map((row) => {
    const decision = canPatientCancel(row.appointment, now);
    return {
      id: row.appointment.id,
      startsAt: row.appointment.startsAt,
      endsAt: row.appointment.endsAt,
      status: row.appointment.status,
      modality: row.appointment.modality,
      priceCents: row.appointment.priceCents,
      meetingUrl: row.appointment.meetingUrl,
      cancellationReason: row.appointment.cancellationReason,
      cancelledBy: row.cancelledByRole,
      serviceName: row.serviceName,
      durationMinutes: row.durationMinutes,
      professional: row.professional,
      cancel: decision.allowed ? { allowed: true } : { allowed: false, reason: decision.reason },
      canJoin: canJoinOnlineRoom(row.appointment, now),
    };
  });

  const isUpcoming = (view: PatientAppointmentView) => view.status === "SCHEDULED" && view.endsAt.getTime() > now.getTime();
  return {
    upcoming: views.filter(isUpcoming),
    past: views.filter((view) => !isUpcoming(view)).reverse(),
  };
}

export type AgendaItem = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  modality: Modality;
  meetingUrl: string | null;
  patientNote: string | null;
  cancellationReason: string | null;
  serviceName: string;
  patient: PatientNameInfo & { id: string };
  canCancel: boolean;
  canRecordOutcome: boolean;
  canJoin: boolean;
};

/**
 * Agenda do profissional. Os pacientes aparecem SEMPRE pelo nome que eles
 * autorizaram (nome completo, primeiro nome, iniciais ou codinome).
 */
export async function listProfessionalAgenda(
  actor: Actor,
  options: { scope: "upcoming" | "past" | "today" | "range"; limit?: number; from?: Date; to?: Date },
  now: Date = new Date(),
): Promise<AgendaItem[]> {
  const professional = assertProfessional(actor);
  const today = dayBounds(todayKey(CLINIC_TIME_ZONE, now), CLINIC_TIME_ZONE);

  const scopeFilter =
    options.scope === "upcoming"
      ? and(eq(appointments.status, "SCHEDULED"), gte(appointments.endsAt, now))
      : options.scope === "today"
        ? and(ne(appointments.status, "CANCELLED"), gte(appointments.startsAt, today.start), lt(appointments.startsAt, today.end))
        : options.scope === "range"
          ? and(
              ne(appointments.status, "CANCELLED"),
              gte(appointments.startsAt, options.from ?? today.start),
              lt(appointments.startsAt, options.to ?? today.end),
            )
          : or(lt(appointments.endsAt, now), ne(appointments.status, "SCHEDULED"));

  const rows = await db
    .select({ appointment: appointments, serviceName: services.name })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .where(and(eq(appointments.professionalId, professional.professionalId), scopeFilter))
    .orderBy(options.scope === "past" ? desc(appointments.startsAt) : asc(appointments.startsAt), asc(appointments.createdAt))
    .limit(options.limit ?? 200);

  const names = await resolveDisplayNames(
    professional.professionalId,
    rows.map((row) => row.appointment.patientId),
  );

  return rows.map(({ appointment, serviceName }) => ({
    id: appointment.id,
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    status: appointment.status,
    modality: appointment.modality,
    meetingUrl: appointment.meetingUrl,
    patientNote: appointment.patientNote,
    cancellationReason: appointment.cancellationReason,
    serviceName,
    patient: {
      id: appointment.patientId,
      ...(names.get(appointment.patientId) ?? { displayName: "Paciente", monogram: "P", preset: "ANONYMOUS" as const }),
    },
    canCancel: canProfessionalCancel(appointment, now).allowed,
    canRecordOutcome: canRecordOutcome(appointment, now).allowed,
    canJoin: canJoinOnlineRoom(appointment, now),
  }));
}

export type ProfessionalPatientListItem = PatientNameInfo & {
  patientId: string;
  nextAppointment: Date | null;
  lastAppointment: Date | null;
  totalAppointments: number;
};

/** Pacientes com vínculo de cuidado com o profissional. */
export async function listProfessionalPatients(actor: Actor, now: Date = new Date()): Promise<ProfessionalPatientListItem[]> {
  const professional = assertProfessional(actor);
  const rows = await db
    .select({ patientId: appointments.patientId, startsAt: appointments.startsAt, status: appointments.status })
    .from(appointments)
    .where(and(eq(appointments.professionalId, professional.professionalId), ne(appointments.status, "CANCELLED")));

  const byPatient = new Map<string, { next: Date | null; last: Date | null; total: number }>();
  for (const row of rows) {
    const entry = byPatient.get(row.patientId) ?? { next: null, last: null, total: 0 };
    entry.total += 1;
    if (row.status === "SCHEDULED" && row.startsAt > now) {
      if (!entry.next || row.startsAt < entry.next) entry.next = row.startsAt;
    } else if (row.startsAt <= now && (!entry.last || row.startsAt > entry.last)) {
      entry.last = row.startsAt;
    }
    byPatient.set(row.patientId, entry);
  }

  const names = await resolveDisplayNames(professional.professionalId, [...byPatient.keys()]);
  return [...byPatient.entries()]
    .map(([patientId, info]) => ({
      patientId,
      ...(names.get(patientId) ?? { displayName: "Paciente", monogram: "P", preset: "ANONYMOUS" as const }),
      nextAppointment: info.next,
      lastAppointment: info.last,
      totalAppointments: info.total,
    }))
    .sort((a, b) => (a.nextAppointment?.getTime() ?? Infinity) - (b.nextAppointment?.getTime() ?? Infinity));
}

export type SharedHistoryItem = {
  id: string;
  startsAt: Date;
  status: AppointmentStatus;
  modality: Modality;
  serviceName: string;
  patientNote: string | null;
  /** Já começou (pode ser vinculada a um registro de evolução). */
  hasStarted: boolean;
};

/** Consultas entre um profissional e um paciente (ficha do paciente). */
export async function listAppointmentsWithPatient(actor: Actor, patientId: string, now: Date = new Date()): Promise<SharedHistoryItem[]> {
  const professional = assertProfessional(actor);
  if (!isUuid(patientId)) return [];
  const rows = await db
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      status: appointments.status,
      modality: appointments.modality,
      serviceName: services.name,
      patientNote: appointments.patientNote,
    })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .where(and(eq(appointments.professionalId, professional.professionalId), eq(appointments.patientId, patientId)))
    .orderBy(desc(appointments.startsAt));
  return rows.map((row) => ({ ...row, hasStarted: row.startsAt.getTime() <= now.getTime() }));
}

export type WeekBlock = { startMinute: number; endMinute: number; kind: "APPOINTMENTS" | "INTERNAL"; label: string | null };
export type WeekAbsence = { startMinute: number; endMinute: number; reason: string | null };
export type WeekAppointment = AgendaItem & { startMinute: number; endMinute: number };
export type WeekDay = { dateKey: string; blocks: WeekBlock[]; absences: WeekAbsence[]; appointments: WeekAppointment[] };
export type ProfessionalWeek = { weekStart: string; days: WeekDay[]; firstMinute: number; lastMinute: number };

/**
 * Semana do profissional para a visão em grade: períodos de trabalho
 * (atendimento e interno), ausências e consultas, dia a dia.
 * @param weekStart segunda-feira da semana (AAAA-MM-DD, fuso da clínica)
 */
export async function getProfessionalWeek(actor: Actor, weekStart: string, now: Date = new Date()): Promise<ProfessionalWeek> {
  const professional = assertProfessional(actor);
  const dateKeys = Array.from({ length: 7 }, (_, index) => addDaysToKey(weekStart, index, CLINIC_TIME_ZONE));
  const rangeStart = dayBounds(dateKeys[0]!, CLINIC_TIME_ZONE).start;
  const rangeEnd = dayBounds(dateKeys[6]!, CLINIC_TIME_ZONE).end;

  const [blocks, absences, items] = await Promise.all([
    getWeeklyBlocks(professional.professionalId),
    db
      .select({ startsAt: timeOffs.startsAt, endsAt: timeOffs.endsAt, reason: timeOffs.reason })
      .from(timeOffs)
      .where(and(eq(timeOffs.professionalId, professional.professionalId), lt(timeOffs.startsAt, rangeEnd), gt(timeOffs.endsAt, rangeStart))),
    listProfessionalAgenda(actor, { scope: "range", from: rangeStart, to: rangeEnd, limit: 300 }, now),
  ]);

  const days: WeekDay[] = dateKeys.map((dateKey, index) => {
    const bounds = dayBounds(dateKey, CLINIC_TIME_ZONE);
    const weekday = index + 1; // a semana começa na segunda (ISO 1)
    return {
      dateKey,
      blocks: blocks
        .filter((block) => block.weekday === weekday)
        .map((block) => ({ startMinute: block.startMinute, endMinute: block.endMinute, kind: block.kind, label: block.label ?? null })),
      absences: absences
        .filter((absence) => absence.startsAt < bounds.end && absence.endsAt > bounds.start)
        .map((absence) => ({
          startMinute: absence.startsAt <= bounds.start ? 0 : minutesOfDay(absence.startsAt),
          endMinute: absence.endsAt >= bounds.end ? 24 * 60 : minutesOfDay(absence.endsAt),
          reason: absence.reason,
        })),
      appointments: items
        .filter((item) => toDateKey(item.startsAt) === dateKey)
        .map((item) => ({
          ...item,
          startMinute: minutesOfDay(item.startsAt),
          endMinute: Math.min(24 * 60, minutesOfDay(item.startsAt) + Math.round((item.endsAt.getTime() - item.startsAt.getTime()) / 60_000)),
        })),
    };
  });

  const starts = days.flatMap((day) => [...day.blocks.map((b) => b.startMinute), ...day.appointments.map((a) => a.startMinute)]);
  const ends = days.flatMap((day) => [...day.blocks.map((b) => b.endMinute), ...day.appointments.map((a) => a.endMinute)]);
  const firstMinute = starts.length ? Math.floor(Math.min(...starts) / 60) * 60 : 8 * 60;
  const lastMinute = ends.length ? Math.ceil(Math.max(...ends) / 60) * 60 : 18 * 60;

  return { weekStart, days, firstMinute, lastMinute: Math.max(lastMinute, firstMinute + 60) };
}

/** Contagem de consultas por status num período (painéis). */
export async function countProfessionalAppointments(professionalId: string, from: Date, to: Date): Promise<number> {
  const rows = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.professionalId, professionalId),
        eq(appointments.status, "SCHEDULED"),
        gte(appointments.startsAt, from),
        lt(appointments.startsAt, to),
      ),
    );
  return rows.length;
}
