import { ONLINE_ROOM_OPENS_MINUTES_BEFORE, PATIENT_CANCELLATION_MIN_HOURS } from "@/config/clinic";

export type AppointmentStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
export type Modality = "ONLINE" | "IN_PERSON";

type AppointmentLike = {
  status: AppointmentStatus;
  startsAt: Date;
  endsAt: Date;
  modality?: Modality;
};

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: "Agendada",
  COMPLETED: "Realizada",
  CANCELLED: "Cancelada",
  NO_SHOW: "Não compareceu",
};

export const MODALITY_LABELS: Record<Modality, string> = {
  ONLINE: "Online",
  IN_PERSON: "Presencial",
};

export type Decision = { allowed: true } | { allowed: false; reason: string };

const HOUR = 60 * 60 * 1000;

/** O paciente cancela sozinho até 24h antes; depois disso, avisa pelo chat. */
export function canPatientCancel(appointment: AppointmentLike, now: Date): Decision {
  if (appointment.status !== "SCHEDULED") return { allowed: false, reason: "Esta consulta não está mais agendada." };
  const hoursLeft = (appointment.startsAt.getTime() - now.getTime()) / HOUR;
  if (hoursLeft < PATIENT_CANCELLATION_MIN_HOURS) {
    return {
      allowed: false,
      reason: `Cancelamentos pelo app são possíveis até ${PATIENT_CANCELLATION_MIN_HOURS}h antes. Avise o profissional pelo chat.`,
    };
  }
  return { allowed: true };
}

/** O profissional pode cancelar a qualquer momento antes do fim da consulta, informando o motivo. */
export function canProfessionalCancel(appointment: AppointmentLike, now: Date): Decision {
  if (appointment.status !== "SCHEDULED") return { allowed: false, reason: "Esta consulta não está mais agendada." };
  if (now.getTime() >= appointment.endsAt.getTime()) {
    return { allowed: false, reason: "A consulta já terminou. Registre se foi realizada ou se o paciente faltou." };
  }
  return { allowed: true };
}

/** Marcar como realizada / falta só depois do horário de início. */
export function canRecordOutcome(appointment: AppointmentLike, now: Date): Decision {
  if (appointment.status !== "SCHEDULED") return { allowed: false, reason: "O resultado desta consulta já foi registrado." };
  if (now.getTime() < appointment.startsAt.getTime()) return { allowed: false, reason: "A consulta ainda não começou." };
  return { allowed: true };
}

export function canJoinOnlineRoom(appointment: AppointmentLike, now: Date): boolean {
  if (appointment.modality !== "ONLINE" || appointment.status !== "SCHEDULED") return false;
  const opensAt = appointment.startsAt.getTime() - ONLINE_ROOM_OPENS_MINUTES_BEFORE * 60 * 1000;
  return now.getTime() >= opensAt && now.getTime() <= appointment.endsAt.getTime();
}

/**
 * Vínculo de cuidado: o profissional só acessa dados e prontuário de quem tem
 * (ou teve) consulta com ele. Consultas canceladas não criam vínculo.
 */
export function hasCareRelationship(statuses: readonly AppointmentStatus[]): boolean {
  return statuses.some((status) => status !== "CANCELLED");
}
