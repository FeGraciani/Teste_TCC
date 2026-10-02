import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, eq, gt, lt } from "drizzle-orm";
import { z } from "zod";
import { ONLINE_MEETING_BASE_URL } from "@/config/clinic";
import { recordAudit } from "@/modules/audit/application/audit-service";
import { getServiceById } from "@/modules/catalog/application/catalog-service";
import { postSystemMessage } from "@/modules/messaging/application/system-messages";
import { assertPatient, assertProfessional, type Actor } from "@/shared/application/actor";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/shared/errors";
import { afterResponse } from "@/shared/infrastructure/after-response";
import { db, type Executor } from "@/shared/infrastructure/database/client";
import { PG_EXCLUSION_VIOLATION, pgErrorCode } from "@/shared/infrastructure/database/errors";
import { professionalProfiles } from "@/shared/infrastructure/database/schema";
import { formatTime, formatWeekdayLong, toDateKey } from "@/shared/lib/datetime";
import { isUuid, parseOrThrow } from "@/shared/lib/validation";
import { MODALITY_LABELS, canPatientCancel, canProfessionalCancel, canRecordOutcome, type Modality } from "../domain/appointment-policy";
import { appointments } from "../infrastructure/schema";
import { emailCancellationNotices, type CancellationNotice } from "./appointment-emails";
import { computeSlots, getProfessionalForBooking } from "./availability-service";

const bookingSchema = z.object({
  professionalId: z.uuid("Escolha um profissional."),
  serviceId: z.uuid("Escolha o tipo de atendimento."),
  startsAt: z.iso.datetime({ offset: true, error: "Escolha um horário." }),
  modality: z.enum(["ONLINE", "IN_PERSON"], { error: "Escolha online ou presencial." }),
  note: z
    .string()
    .trim()
    .max(500, "Use no máximo 500 caracteres.")
    .optional()
    .transform((value) => (value ? value : null)),
});

function describeSlot(startsAt: Date, modality: Modality): string {
  return `${formatWeekdayLong(startsAt)}, às ${formatTime(startsAt)} (${MODALITY_LABELS[modality].toLowerCase()})`;
}

/**
 * Trava a agenda de um profissional até o fim da transação. Toda operação que
 * muda o que está livre (agendar, salvar a grade, registrar ausência) passa
 * por aqui, então elas acontecem uma de cada vez para o mesmo profissional.
 */
export async function lockProfessionalAgenda(tx: Executor, professionalId: string): Promise<void> {
  await tx.select({ id: professionalProfiles.id }).from(professionalProfiles).where(eq(professionalProfiles.id, professionalId)).for("update");
}

function newMeetingUrl(): string {
  return `${ONLINE_MEETING_BASE_URL}/AlentoSala-${randomBytes(12).toString("hex")}`;
}

/**
 * Agenda uma consulta. O horário é recalculado dentro de uma transação que
 * trava a agenda do profissional, e o banco ainda recusa sobreposições
 * (restrição EXCLUDE) — dois pacientes nunca pegam o mesmo horário.
 */
export async function bookAppointment(actor: Actor, raw: unknown, now: Date = new Date()): Promise<{ appointmentId: string }> {
  const patient = assertPatient(actor);
  const input = parseOrThrow(bookingSchema, raw);

  const professional = await getProfessionalForBooking(input.professionalId);
  if (!professional || !professional.userActive) throw new NotFoundError("Este profissional não está recebendo agendamentos.");
  const service = await getServiceById(input.serviceId);
  if (!service || !service.active) throw new NotFoundError("Este atendimento não está disponível.");
  if (service.specialty !== professional.specialty) throw new ValidationError("Este profissional não realiza esse atendimento.");
  if (input.modality === "ONLINE" && !professional.acceptsOnline) throw new ValidationError("Este profissional atende apenas presencialmente.");
  if (input.modality === "IN_PERSON" && !professional.acceptsInPerson) throw new ValidationError("Este profissional atende apenas online.");

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
  const dateKey = toDateKey(startsAt);

  try {
    return await db.transaction(async (tx) => {
      // Trava a agenda deste profissional até o fim da transação.
      await lockProfessionalAgenda(tx, professional.id);

      const slots = await computeSlots(tx, {
        professionalId: professional.id,
        durationMinutes: service.durationMinutes,
        fromDate: dateKey,
        toDate: dateKey,
        now,
      });
      if (!slots.some((slot) => slot.startsAt.getTime() === startsAt.getTime())) {
        throw new ConflictError("Esse horário acabou de ser reservado ou não está mais disponível. Escolha outro, por favor.");
      }

      const [clash] = await tx
        .select({ id: appointments.id })
        .from(appointments)
        .where(
          and(
            eq(appointments.patientId, patient.patientId),
            eq(appointments.status, "SCHEDULED"),
            lt(appointments.startsAt, endsAt),
            gt(appointments.endsAt, startsAt),
          ),
        )
        .limit(1);
      if (clash) throw new ConflictError("Você já tem outra consulta nesse horário.");

      const [created] = await tx
        .insert(appointments)
        .values({
          patientId: patient.patientId,
          professionalId: professional.id,
          serviceId: service.id,
          startsAt,
          endsAt,
          modality: input.modality,
          priceCents: service.priceCents,
          patientNote: input.note,
          meetingUrl: input.modality === "ONLINE" ? newMeetingUrl() : null,
        })
        .returning({ id: appointments.id });

      await postSystemMessage(tx, {
        patientId: patient.patientId,
        professionalId: professional.id,
        triggeredByUserId: patient.userId,
        text: `Consulta agendada: ${service.name}, ${describeSlot(startsAt, input.modality)}.`,
      });
      await recordAudit(
        {
          actor,
          action: "APPOINTMENT_BOOKED",
          subjectPatientId: patient.patientId,
          entityType: "appointment",
          entityId: created.id,
          metadata: { professionalId: professional.id, serviceId: service.id, startsAt: startsAt.toISOString() },
        },
        tx,
      );
      return { appointmentId: created.id };
    });
  } catch (error) {
    if (pgErrorCode(error) === PG_EXCLUSION_VIOLATION) {
      throw new ConflictError("Esse horário acabou de ser reservado. Escolha outro, por favor.");
    }
    throw error;
  }
}

const cancelSchema = z.object({
  appointmentId: z.uuid(),
  reason: z
    .string()
    .trim()
    .max(300, "Use no máximo 300 caracteres.")
    .optional()
    .transform((value) => (value ? value : null)),
});

type LoadedAppointment = Awaited<ReturnType<typeof loadAppointment>>;

async function loadAppointment(executor: Executor, appointmentId: string) {
  if (!isUuid(appointmentId)) return null;
  const [row] = await executor
    .select({
      appointment: appointments,
      professionalName: professionalProfiles.displayName,
      professionalUserId: professionalProfiles.userId,
    })
    .from(appointments)
    .innerJoin(professionalProfiles, eq(professionalProfiles.id, appointments.professionalId))
    .where(eq(appointments.id, appointmentId))
    .limit(1);
  return row ?? null;
}

/**
 * Cancela e avisa a outra parte pelo chat.
 * Paciente: até 24h antes. Profissional/administração: a qualquer momento antes do fim, com motivo.
 */
export async function cancelAppointment(actor: Actor, raw: unknown, now: Date = new Date()): Promise<void> {
  const input = parseOrThrow(cancelSchema, raw);
  const loaded = await loadAppointment(db, input.appointmentId);
  if (!loaded) throw new NotFoundError("Consulta não encontrada.");
  const { appointment } = loaded;

  if (actor.role === "PATIENT") {
    if (appointment.patientId !== actor.patientId) throw new NotFoundError("Consulta não encontrada.");
    const decision = canPatientCancel(appointment, now);
    if (!decision.allowed) throw new ForbiddenError(decision.reason);
  } else {
    if (actor.role === "PROFESSIONAL" && appointment.professionalId !== actor.professionalId) {
      throw new NotFoundError("Consulta não encontrada.");
    }
    const decision = canProfessionalCancel(appointment, now);
    if (!decision.allowed) throw new ForbiddenError(decision.reason);
    if (!input.reason || input.reason.length < 5) {
      throw new ValidationError("Informe o motivo — ele será enviado ao paciente pelo chat.", {
        reason: ["Informe o motivo do cancelamento."],
      });
    }
  }

  const notice = await db.transaction(async (tx) => cancelWithinTransaction(tx, actor, loaded, input.reason, now));
  // O aviso principal já está no chat; o e-mail sai depois da resposta.
  await afterResponse(() => emailCancellationNotices([notice]));
}

/** Núcleo do cancelamento (reutilizado ao registrar ausências). */
export async function cancelWithinTransaction(
  tx: Executor,
  actor: Actor,
  loaded: NonNullable<LoadedAppointment>,
  reason: string | null,
  now: Date,
): Promise<CancellationNotice> {
  const { appointment } = loaded;
  const updated = await tx
    .update(appointments)
    .set({ status: "CANCELLED", cancelledAt: now, cancelledByUserId: actor.userId, cancellationReason: reason })
    .where(and(eq(appointments.id, appointment.id), eq(appointments.status, "SCHEDULED")))
    .returning({ id: appointments.id });
  if (updated.length === 0) throw new ConflictError("Esta consulta já foi alterada. Atualize a página.");

  const when = `${formatWeekdayLong(appointment.startsAt)}, às ${formatTime(appointment.startsAt)}`;
  const text =
    actor.role === "PATIENT"
      ? `Consulta de ${when} cancelada pelo paciente.${reason ? ` Motivo: "${reason}".` : ""}`
      : actor.role === "PROFESSIONAL"
        ? `⚠️ ${loaded.professionalName} cancelou a consulta de ${when}. Motivo: "${reason}". Você pode escolher um novo horário em Agendar consulta.`
        : `⚠️ A clínica cancelou a consulta de ${when}. Motivo: "${reason}". Você pode escolher um novo horário em Agendar consulta.`;

  await postSystemMessage(tx, {
    patientId: appointment.patientId,
    professionalId: appointment.professionalId,
    triggeredByUserId: actor.userId,
    text,
  });
  await recordAudit(
    {
      actor,
      action: "APPOINTMENT_CANCELLED",
      subjectPatientId: appointment.patientId,
      entityType: "appointment",
      entityId: appointment.id,
      metadata: { by: actor.role, hadReason: Boolean(reason) },
    },
    tx,
  );
  return { appointmentId: appointment.id, patientId: appointment.patientId, startsAt: appointment.startsAt, cancelledBy: actor.role };
}

/**
 * Cancela todas as consultas futuras de um profissional (ex.: acesso
 * desativado pela administração), avisando cada paciente pelo chat.
 * Devolve os avisos para envio por e-mail depois do commit.
 */
export async function cancelFutureAppointmentsOf(
  tx: Executor,
  actor: Actor,
  professionalId: string,
  reason: string,
  now: Date,
): Promise<CancellationNotice[]> {
  await lockProfessionalAgenda(tx, professionalId);
  const upcoming = await tx
    .select({ id: appointments.id })
    .from(appointments)
    .where(and(eq(appointments.professionalId, professionalId), eq(appointments.status, "SCHEDULED"), gt(appointments.startsAt, now)))
    .orderBy(asc(appointments.startsAt));
  const notices: CancellationNotice[] = [];
  for (const item of upcoming) {
    const loaded = await loadAppointment(tx, item.id);
    if (loaded) notices.push(await cancelWithinTransaction(tx, actor, loaded, reason, now));
  }
  return notices;
}

export async function loadAppointmentForUpdate(executor: Executor, appointmentId: string) {
  return loadAppointment(executor, appointmentId);
}

/** Profissional registra se a consulta aconteceu ou se o paciente faltou. */
export async function recordAppointmentOutcome(
  actor: Actor,
  input: { appointmentId: string; outcome: "COMPLETED" | "NO_SHOW" },
  now: Date = new Date(),
): Promise<void> {
  const professional = assertProfessional(actor);
  const loaded = await loadAppointment(db, input.appointmentId);
  if (!loaded || loaded.appointment.professionalId !== professional.professionalId) throw new NotFoundError("Consulta não encontrada.");
  const decision = canRecordOutcome(loaded.appointment, now);
  if (!decision.allowed) throw new ForbiddenError(decision.reason);

  await db.transaction(async (tx) => {
    const updated = await tx
      .update(appointments)
      .set({ status: input.outcome })
      .where(and(eq(appointments.id, input.appointmentId), eq(appointments.status, "SCHEDULED")))
      .returning({ id: appointments.id });
    if (updated.length === 0) throw new ConflictError("Esta consulta já foi alterada. Atualize a página.");
    await recordAudit(
      {
        actor,
        action: input.outcome === "COMPLETED" ? "APPOINTMENT_COMPLETED" : "APPOINTMENT_NO_SHOW",
        subjectPatientId: loaded.appointment.patientId,
        entityType: "appointment",
        entityId: input.appointmentId,
      },
      tx,
    );
  });
}
