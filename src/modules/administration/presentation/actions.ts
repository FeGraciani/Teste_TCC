"use server";

import { refresh } from "next/cache";
import { saveService } from "@/modules/catalog/application/catalog-service";
import { sendAccessLinkByAdmin, type AccountLinkSent } from "@/modules/identity/application/account-access-service";
import { requireRole } from "@/modules/identity/application/current-actor";
import { ACCOUNT_LINK_TTL_LABEL } from "@/modules/identity/domain/account-links";
import type { ActionState } from "@/shared/lib/action-state";
import { formDataToObject } from "@/shared/lib/validation";
import { runAction } from "@/shared/presentation/run-action";
import { createAdmin, createProfessional, setUserActive, updateProfessional } from "../application/administration-service";

/** Explica para a administração o que aconteceu com o link — sem nunca mostrar senha. */
function linkOutcome(link: AccountLinkSent, done: string): ActionState {
  if (link.emailStatus === "not-sent") {
    return {
      status: "error",
      message: `${done} Mas o e-mail NÃO foi enviado: o envio de e-mails não está configurado no servidor (SMTP_URL) ou o provedor recusou. Corrija e use “${link.purpose === "INVITE" ? "Reenviar convite" : "Enviar link de nova senha"}”.`,
      at: Date.now(),
    };
  }
  const sent =
    link.purpose === "INVITE"
      ? `Enviamos o convite para ${link.maskedEmail}: a pessoa cria a própria senha pelo link, que vale ${ACCOUNT_LINK_TTL_LABEL.INVITE}.`
      : `Enviamos um link para ${link.maskedEmail} criar uma nova senha. Ele vale ${ACCOUNT_LINK_TTL_LABEL.PASSWORD_RESET}, e a senha atual continua valendo até a própria pessoa trocá-la.`;
  return { status: "success", message: `${done} ${sent}`.trim(), devLink: link.devPreviewUrl ?? undefined, at: Date.now() };
}

export async function createProfessionalAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("ADMIN");
  let result: ActionState = { status: "idle" };
  const state = await runAction(async () => {
    const { invite } = await createProfessional(actor, formDataToObject(formData));
    result = linkOutcome(
      invite,
      `Cadastro de ${String(formData.get("displayName") ?? "profissional").trim()} criado, com agenda inicial de segunda a sexta (8h–12h e 14h–18h).`,
    );
  }, formData);
  return state.status === "error" ? state : result;
}

export async function updateProfessionalAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("ADMIN");
  return runAction(async () => {
    await updateProfessional(actor, String(formData.get("professionalId") ?? ""), formDataToObject(formData));
    refresh();
    return "Cadastro do profissional atualizado.";
  }, formData);
}

/**
 * Ativa ou desativa qualquer conta. Desativar encerra as sessões abertas na
 * hora e, para profissionais, cancela as consultas futuras avisando os pacientes.
 */
export async function setUserActiveAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("ADMIN");
  return runAction(async () => {
    const active = formData.get("active") === "true";
    const { cancelledAppointments } = await setUserActive(actor, String(formData.get("userId") ?? ""), active);
    refresh();
    if (active) return "Acesso reativado.";
    if (cancelledAppointments === 0) return "Acesso desativado. As sessões abertas foram encerradas.";
    return `Acesso desativado. As sessões abertas foram encerradas e ${cancelledAppointments === 1 ? "1 consulta futura foi cancelada" : `${cancelledAppointments} consultas futuras foram canceladas`}, com aviso aos pacientes pelo chat e por e-mail.`;
  });
}

/** Envia ao DONO da conta um link para criar uma nova senha (ou reenvia o convite). */
export async function sendAccessLinkAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("ADMIN");
  let result: ActionState = { status: "idle" };
  const state = await runAction(async () => {
    result = linkOutcome(await sendAccessLinkByAdmin(actor, String(formData.get("userId") ?? "")), "");
  });
  return state.status === "error" ? state : result;
}

export async function saveServiceAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("ADMIN");
  return runAction(async () => {
    await saveService(actor, formDataToObject(formData));
    refresh();
    return "Serviço salvo. O valor já aparece no site e vale para os próximos agendamentos.";
  }, formData);
}

export async function createAdminAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("ADMIN");
  let result: ActionState = { status: "idle" };
  const state = await runAction(async () => {
    const { invite } = await createAdmin(actor, formDataToObject(formData));
    refresh();
    result = linkOutcome(invite, "Conta administrativa criada.");
  }, formData);
  return state.status === "error" ? state : result;
}
