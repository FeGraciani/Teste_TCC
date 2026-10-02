"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireActor, requireRole } from "@/modules/identity/application/current-actor";
import type { ActionState } from "@/shared/lib/action-state";
import { formDataToObject } from "@/shared/lib/validation";
import { runAction } from "@/shared/presentation/run-action";
import { bookAppointment, cancelAppointment, recordAppointmentOutcome } from "../application/booking-service";
import { addTimeOff, removeTimeOff, saveScheduleSettings, saveWeeklySchedule } from "../application/schedule-service";

/** Paciente confirma um horário livre. O horário é revalidado dentro de uma transação. */
export async function bookAppointmentAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("PATIENT");
  return runAction(async () => {
    const { appointmentId } = await bookAppointment(actor, formDataToObject(formData));
    redirect(`/paciente/consultas?agendada=${appointmentId}`);
  }, formData);
}

/** Cancelamento por paciente (até 24h antes), profissional ou administração (com motivo). */
export async function cancelAppointmentAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireActor();
  return runAction(async () => {
    await cancelAppointment(actor, formDataToObject(formData));
    refresh();
    return actor.role === "PATIENT"
      ? "Consulta cancelada. O profissional foi avisado pelo chat."
      : "Consulta cancelada. O paciente foi avisado pelo chat, com o motivo informado.";
  }, formData);
}

export async function recordOutcomeAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("PROFESSIONAL");
  return runAction(async () => {
    const outcome = formData.get("outcome") === "NO_SHOW" ? "NO_SHOW" : "COMPLETED";
    await recordAppointmentOutcome(actor, { appointmentId: String(formData.get("appointmentId") ?? ""), outcome });
    refresh();
    return outcome === "COMPLETED" ? "Consulta marcada como realizada." : "Falta registrada.";
  });
}

/** Grade semanal enviada como lista (editor interativo da tela de horários). */
export async function saveWeeklyScheduleAction(blocks: unknown): Promise<ActionState> {
  const actor = await requireRole("PROFESSIONAL");
  return runAction(async () => {
    await saveWeeklySchedule(actor, blocks);
    refresh();
    return "Horários salvos. Eles valem para os próximos agendamentos; consultas já marcadas não mudam.";
  });
}

export async function saveScheduleSettingsAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("PROFESSIONAL");
  return runAction(async () => {
    await saveScheduleSettings(actor, formDataToObject(formData));
    refresh();
    return "Regras da agenda atualizadas.";
  }, formData);
}

export async function addTimeOffAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("PROFESSIONAL");
  return runAction(async () => {
    const { conflicts, cancelled } = await addTimeOff(actor, formDataToObject(formData));
    refresh();
    if (cancelled > 0) {
      return cancelled === 1
        ? "Ausência registrada. 1 consulta foi cancelada e o paciente foi avisado pelo chat."
        : `Ausência registrada. ${cancelled} consultas foram canceladas e cada paciente foi avisado pelo chat.`;
    }
    if (conflicts > 0) {
      return conflicts === 1
        ? "Ausência registrada. Atenção: 1 consulta já marcada nesse período continua de pé — cancele-a pela agenda, se necessário."
        : `Ausência registrada. Atenção: ${conflicts} consultas já marcadas nesse período continuam de pé — cancele-as pela agenda, se necessário.`;
    }
    return "Ausência registrada. Esse período não aparece mais para agendamento.";
  }, formData);
}

export async function removeTimeOffAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("PROFESSIONAL");
  return runAction(async () => {
    await removeTimeOff(actor, String(formData.get("timeOffId") ?? ""));
    refresh();
    return "Ausência removida. O período voltou a ficar disponível.";
  });
}
