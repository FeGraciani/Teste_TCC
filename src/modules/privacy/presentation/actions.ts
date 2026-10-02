"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/modules/identity/application/current-actor";
import type { ActionState } from "@/shared/lib/action-state";
import { runAction } from "@/shared/presentation/run-action";
import {
  removePrivacyOverride,
  requestFieldAccess,
  respondToAccessRequest,
  revokeFieldGrants,
  savePrivacySettings,
} from "../application/privacy-service";

/** Salva a configuração padrão (professionalId = null) ou a exceção de um profissional. */
export async function savePrivacySettingsAction(input: { professionalId: string | null; fields: unknown }): Promise<ActionState> {
  const actor = await requireRole("PATIENT");
  return runAction(async () => {
    await savePrivacySettings(actor, { professionalId: input.professionalId, fields: input.fields });
    refresh();
    return input.professionalId
      ? "Exceção salva. A partir de agora, este profissional vê exatamente o que você escolheu."
      : "Preferências salvas. Elas valem para todos os profissionais sem exceção própria.";
  });
}

export async function removePrivacyOverrideAction(professionalId: string): Promise<ActionState> {
  const actor = await requireRole("PATIENT");
  return runAction(async () => {
    await removePrivacyOverride(actor, professionalId);
    refresh();
    return "Exceção removida. Este profissional volta a seguir sua configuração padrão.";
  });
}

/** Paciente aprova ou recusa o pedido de um profissional para ver dados ocultos. */
export async function respondToAccessRequestAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("PATIENT");
  return runAction(async () => {
    const approve = formData.get("decision") === "approve";
    await respondToAccessRequest(actor, { requestId: String(formData.get("requestId") ?? ""), approve });
    refresh();
    return approve
      ? "Pedido aprovado. Só os dados pedidos foram liberados, e só para este profissional. Você pode revogar quando quiser, aqui em Privacidade."
      : "Pedido recusado. Nada foi liberado.";
  });
}

/** Paciente revoga um dado liberado por pedido (ou todos os dados liberados a um profissional). */
export async function revokeGrantAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("PATIENT");
  return runAction(async () => {
    const revoked = await revokeFieldGrants(actor, {
      professionalId: String(formData.get("professionalId") ?? ""),
      field: formData.get("field") ? String(formData.get("field")) : null,
    });
    refresh();
    return revoked === 1
      ? "Liberação revogada. O profissional foi avisado pelo chat."
      : "Liberações revogadas. O profissional foi avisado pelo chat.";
  });
}

/** Profissional pede ao paciente para ver dados ocultos, explicando o motivo. */
export async function requestFieldAccessAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("PROFESSIONAL");
  return runAction(async () => {
    await requestFieldAccess(actor, {
      patientId: String(formData.get("patientId") ?? ""),
      fields: formData.getAll("fields").map(String),
      reason: String(formData.get("reason") ?? ""),
    });
    refresh();
    return "Pedido enviado. O paciente foi avisado pelo chat e decide em “Privacidade”.";
  }, formData);
}
