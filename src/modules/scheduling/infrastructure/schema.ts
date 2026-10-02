import { index, integer, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, timestamptz, updatedAt } from "../../../shared/infrastructure/database/columns";
import { services } from "../../catalog/infrastructure/schema";
import { patientProfiles, professionalProfiles, users } from "../../identity/infrastructure/schema";

/** APPOINTMENTS = horário de atendimento (reservável); INTERNAL = trabalho interno (não reservável). */
export const scheduleBlockKindEnum = pgEnum("schedule_block_kind", ["APPOINTMENTS", "INTERNAL"]);
export const appointmentStatusEnum = pgEnum("appointment_status", ["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"]);
export const modalityEnum = pgEnum("modality", ["ONLINE", "IN_PERSON"]);

/** Regras de agenda de cada profissional. */
export const scheduleSettings = pgTable("schedule_settings", {
  professionalId: uuid("professional_id")
    .primaryKey()
    .references(() => professionalProfiles.id, { onDelete: "cascade" }),
  /** Intervalo mínimo entre dois atendimentos. */
  bufferMinutes: integer("buffer_minutes").notNull().default(10),
  /** De quantos em quantos minutos os horários são oferecidos. */
  slotStepMinutes: integer("slot_step_minutes").notNull().default(60),
  /** Antecedência mínima para o paciente agendar. */
  minNoticeHours: integer("min_notice_hours").notNull().default(12),
  /** Até quantos dias à frente a agenda fica aberta. */
  bookingWindowDays: integer("booking_window_days").notNull().default(45),
  updatedAt: updatedAt(),
});

/** Grade semanal recorrente (1 = segunda … 7 = domingo; minutos desde 00:00). */
export const weeklyScheduleBlocks = pgTable(
  "weekly_schedule_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionalProfiles.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
    kind: scheduleBlockKindEnum("kind").notNull(),
    label: text("label"),
  },
  (t) => [index("weekly_schedule_blocks_professional_idx").on(t.professionalId, t.weekday)],
);

/** Ausências pontuais: férias, congressos, folgas. */
export const timeOffs = pgTable(
  "time_offs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionalProfiles.id, { onDelete: "cascade" }),
    startsAt: timestamptz("starts_at").notNull(),
    endsAt: timestamptz("ends_at").notNull(),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (t) => [index("time_offs_professional_idx").on(t.professionalId, t.startsAt)],
);

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patientProfiles.id, { onDelete: "restrict" }),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionalProfiles.id, { onDelete: "restrict" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    startsAt: timestamptz("starts_at").notNull(),
    endsAt: timestamptz("ends_at").notNull(),
    status: appointmentStatusEnum("status").notNull().default("SCHEDULED"),
    modality: modalityEnum("modality").notNull(),
    /** Preço no momento do agendamento (mudanças futuras de preço não afetam). */
    priceCents: integer("price_cents").notNull(),
    /** Recado opcional do paciente ao agendar (visível ao profissional). */
    patientNote: text("patient_note"),
    meetingUrl: text("meeting_url"),
    cancelledAt: timestamptz("cancelled_at"),
    cancelledByUserId: uuid("cancelled_by_user_id").references(() => users.id, { onDelete: "set null" }),
    cancellationReason: text("cancellation_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("appointments_professional_starts_idx").on(t.professionalId, t.startsAt),
    index("appointments_patient_starts_idx").on(t.patientId, t.startsAt),
  ],
);

export type ScheduleSettingsRow = typeof scheduleSettings.$inferSelect;
export type WeeklyScheduleBlockRow = typeof weeklyScheduleBlocks.$inferSelect;
export type TimeOffRow = typeof timeOffs.$inferSelect;
export type AppointmentRow = typeof appointments.$inferSelect;
