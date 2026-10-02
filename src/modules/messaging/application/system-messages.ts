import "server-only";
import { and, eq } from "drizzle-orm";
import { encrypt } from "@/shared/infrastructure/crypto";
import type { Executor } from "@/shared/infrastructure/database/client";
import { conversations, messages } from "../infrastructure/schema";

/**
 * Operações de baixo nível do chat usadas por outros módulos
 * (agendamento, cancelamento, pedidos de acesso). Não depende de privacidade.
 */
export async function ensureConversation(executor: Executor, patientId: string, professionalId: string): Promise<string> {
  await executor
    .insert(conversations)
    .values({ patientId, professionalId })
    .onConflictDoNothing({
      target: [conversations.patientId, conversations.professionalId],
    });
  const [row] = await executor
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.patientId, patientId), eq(conversations.professionalId, professionalId)))
    .limit(1);
  return row.id;
}

/** Publica um aviso automático no chat do par paciente ↔ profissional. */
export async function postSystemMessage(
  executor: Executor,
  params: { patientId: string; professionalId: string; text: string; triggeredByUserId: string | null },
): Promise<void> {
  const conversationId = await ensureConversation(executor, params.patientId, params.professionalId);
  const now = new Date();
  await executor.insert(messages).values({
    conversationId,
    senderUserId: params.triggeredByUserId,
    kind: "SYSTEM",
    bodyEncrypted: encrypt(params.text),
    createdAt: now,
  });
  await executor.update(conversations).set({ lastMessageAt: now }).where(eq(conversations.id, conversationId));
}
