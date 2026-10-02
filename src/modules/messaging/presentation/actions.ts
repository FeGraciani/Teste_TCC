"use server";

import { redirect } from "next/navigation";
import { requireActor } from "@/modules/identity/application/current-actor";
import { ROLE_HOME } from "@/modules/identity/domain/roles";
import { isDomainError } from "@/shared/errors";
import { conversationWith, sendMessage, type ChatMessage } from "../application/chat-service";

export type SendMessageResult = { ok: true; message: ChatMessage } | { ok: false; error: string };

/** Envia uma mensagem e devolve a mensagem gravada (o chat a exibe na hora). */
export async function sendMessageAction(conversationId: string, body: string): Promise<SendMessageResult> {
  const actor = await requireActor();
  try {
    return { ok: true, message: await sendMessage(actor, { conversationId, body }) };
  } catch (error) {
    if (isDomainError(error)) return { ok: false, error: error.message };
    console.error("[chat] falha ao enviar", error);
    return { ok: false, error: "Não foi possível enviar agora. Tente de novo." };
  }
}

/** Abre (ou cria) a conversa com a outra parte e leva até ela. Exige vínculo de cuidado. */
export async function openConversationAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  const counterpartId = String(formData.get("counterpartId") ?? "");
  const conversationId = await conversationWith(actor, counterpartId);
  redirect(`${ROLE_HOME[actor.role]}/mensagens?c=${conversationId}`);
}
