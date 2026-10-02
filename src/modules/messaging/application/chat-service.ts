import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { resolveDisplayNames } from "@/modules/privacy/application/privacy-service";
import { presetLabel, type PrivacyPresetKey } from "@/modules/privacy/domain/privacy-fields";
import { assertCareRelationship } from "@/modules/scheduling/application/care-relationship";
import type { Actor } from "@/shared/application/actor";
import { ForbiddenError, NotFoundError, ValidationError } from "@/shared/errors";
import { decrypt, encrypt } from "@/shared/infrastructure/crypto";
import { db } from "@/shared/infrastructure/database/client";
import { patientProfiles, professionalProfiles, users } from "@/shared/infrastructure/database/schema";
import { isUuid } from "@/shared/lib/validation";
import { conversations, messages, type ConversationRow } from "../infrastructure/schema";
import { ensureConversation } from "./system-messages";

export const MESSAGE_MAX_LENGTH = 2000;

export type Counterpart = {
  name: string;
  subtitle: string;
  monogram: string;
  specialty?: "PSYCHOLOGY" | "PSYCHIATRY";
  preset?: PrivacyPresetKey;
};

export type ConversationSummary = {
  id: string;
  counterpart: Counterpart;
  lastMessageAt: Date;
  preview: string | null;
  previewIsSystem: boolean;
  unread: number;
};

export type ChatMessage = {
  id: string;
  kind: "USER" | "SYSTEM";
  body: string;
  createdAt: string;
  mine: boolean;
};

function participantFilter(actor: Actor) {
  if (actor.role === "PATIENT") return eq(conversations.patientId, actor.patientId);
  if (actor.role === "PROFESSIONAL") return eq(conversations.professionalId, actor.professionalId);
  throw new ForbiddenError("O chat é exclusivo entre paciente e profissional.");
}

function lastReadColumn(actor: Actor) {
  return actor.role === "PATIENT" ? conversations.patientLastReadAt : conversations.professionalLastReadAt;
}

/** Mensagens não lidas: da outra parte (ou avisos provocados por ela) depois da última leitura. */
function unreadCondition(actor: Actor) {
  return and(
    or(isNull(messages.senderUserId), ne(messages.senderUserId, actor.userId)),
    sql`${messages.createdAt} > coalesce(${lastReadColumn(actor)}, 'epoch'::timestamptz)`,
  );
}

function monogramOf(name: string): string {
  const parts = name.replace(/^(Dra?\.)\s+/i, "").split(/\s+/);
  return (parts[0]?.charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : "")).toUpperCase();
}

async function counterpartsFor(actor: Actor, rows: ConversationRow[]): Promise<Map<string, Counterpart>> {
  const result = new Map<string, Counterpart>();
  if (actor.role === "PATIENT") {
    const ids = [...new Set(rows.map((row) => row.professionalId))];
    if (ids.length === 0) return result;
    const professionals = await db
      .select({
        id: professionalProfiles.id,
        displayName: professionalProfiles.displayName,
        title: professionalProfiles.title,
        specialty: professionalProfiles.specialty,
      })
      .from(professionalProfiles)
      .where(inArray(professionalProfiles.id, ids));
    for (const row of rows) {
      const professional = professionals.find((item) => item.id === row.professionalId);
      if (professional) {
        result.set(row.id, {
          name: professional.displayName,
          subtitle: professional.title,
          monogram: monogramOf(professional.displayName),
          specialty: professional.specialty,
        });
      }
    }
  } else if (actor.role === "PROFESSIONAL") {
    const names = await resolveDisplayNames(
      actor.professionalId,
      rows.map((row) => row.patientId),
    );
    for (const row of rows) {
      const info = names.get(row.patientId);
      result.set(row.id, {
        name: info?.displayName ?? "Paciente",
        subtitle: info ? `Modo ${presetLabel(info.preset).toLowerCase()}` : "Paciente",
        monogram: info?.monogram ?? "P",
        preset: info?.preset,
      });
    }
  }
  return result;
}

export async function listConversations(actor: Actor): Promise<ConversationSummary[]> {
  const rows = await db.select().from(conversations).where(participantFilter(actor)).orderBy(desc(conversations.lastMessageAt));
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);

  const lastMessages = await db
    .selectDistinctOn([messages.conversationId], {
      conversationId: messages.conversationId,
      kind: messages.kind,
      bodyEncrypted: messages.bodyEncrypted,
    })
    .from(messages)
    .where(inArray(messages.conversationId, ids))
    .orderBy(messages.conversationId, desc(messages.createdAt));

  const unread = await db
    .select({ conversationId: messages.conversationId, total: count() })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(and(inArray(messages.conversationId, ids), unreadCondition(actor)))
    .groupBy(messages.conversationId);

  const counterparts = await counterpartsFor(actor, rows);
  return rows.map((row) => {
    const last = lastMessages.find((message) => message.conversationId === row.id);
    const body = last ? decrypt(last.bodyEncrypted) : null;
    return {
      id: row.id,
      counterpart: counterparts.get(row.id) ?? { name: "Conversa", subtitle: "", monogram: "?" },
      lastMessageAt: row.lastMessageAt,
      preview: body ? (body.length > 90 ? `${body.slice(0, 90)}…` : body) : null,
      previewIsSystem: last?.kind === "SYSTEM",
      unread: unread.find((item) => item.conversationId === row.id)?.total ?? 0,
    };
  });
}

export async function countUnreadMessages(actor: Actor): Promise<number> {
  if (actor.role === "ADMIN") return 0;
  const [row] = await db
    .select({ total: count() })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(and(participantFilter(actor), unreadCondition(actor)));
  return row?.total ?? 0;
}

async function loadConversationFor(actor: Actor, conversationId: string): Promise<ConversationRow> {
  if (!isUuid(conversationId)) throw new NotFoundError("Conversa não encontrada.");
  const [row] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), participantFilter(actor)))
    .limit(1);
  if (!row) throw new NotFoundError("Conversa não encontrada.");
  return row;
}

async function markAsRead(actor: Actor, conversationId: string): Promise<void> {
  const now = new Date();
  await db
    .update(conversations)
    .set(actor.role === "PATIENT" ? { patientLastReadAt: now } : { professionalLastReadAt: now })
    .where(eq(conversations.id, conversationId));
}

function toChatMessage(actor: Actor, row: typeof messages.$inferSelect): ChatMessage {
  return {
    id: row.id,
    kind: row.kind,
    body: decrypt(row.bodyEncrypted),
    createdAt: row.createdAt.toISOString(),
    mine: row.kind === "USER" && row.senderUserId === actor.userId,
  };
}

export type ConversationDetail = {
  id: string;
  counterpart: Counterpart;
  patientId: string;
  professionalId: string;
  /** A outra parte ainda tem acesso ativo? Se não, a conversa fica só para leitura. */
  counterpartActive: boolean;
  messages: ChatMessage[];
};

/** Conta da outra parte ativa (profissional que deixou a clínica ou paciente desativado = só leitura). */
async function isCounterpartActive(actor: Actor, conversation: ConversationRow): Promise<boolean> {
  const [row] =
    actor.role === "PATIENT"
      ? await db
          .select({ active: users.active })
          .from(professionalProfiles)
          .innerJoin(users, eq(users.id, professionalProfiles.userId))
          .where(eq(professionalProfiles.id, conversation.professionalId))
          .limit(1)
      : await db
          .select({ active: users.active })
          .from(patientProfiles)
          .innerJoin(users, eq(users.id, patientProfiles.userId))
          .where(eq(patientProfiles.id, conversation.patientId))
          .limit(1);
  return row?.active ?? false;
}

export async function openConversation(actor: Actor, conversationId: string): Promise<ConversationDetail> {
  const conversation = await loadConversationFor(actor, conversationId);
  const rows = await db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(desc(messages.createdAt)).limit(150);
  await markAsRead(actor, conversationId);
  const counterparts = await counterpartsFor(actor, [conversation]);
  return {
    id: conversation.id,
    counterpart: counterparts.get(conversation.id) ?? { name: "Conversa", subtitle: "", monogram: "?" },
    patientId: conversation.patientId,
    professionalId: conversation.professionalId,
    counterpartActive: await isCounterpartActive(actor, conversation),
    messages: rows.reverse().map((row) => toChatMessage(actor, row)),
  };
}

/**
 * Quanto a consulta volta no tempo além do cursor do navegador. Avisos
 * automáticos ganham o horário quando são criados, mas só ficam visíveis
 * quando a transação deles termina (ex.: uma ausência que cancela várias
 * consultas). Se outra mensagem for gravada nesse meio-tempo, o cursor passa
 * do aviso; a janela de sobreposição o recupera. O navegador descarta as
 * repetidas pelo id.
 */
export const POLL_OVERLAP_MS = 2 * 60 * 1000;

/** Mensagens a partir de um instante (atualização automática do chat). */
export async function listMessagesSince(actor: Actor, conversationId: string, after: Date | null): Promise<ChatMessage[]> {
  await loadConversationFor(actor, conversationId);
  const from = after ? new Date(after.getTime() - POLL_OVERLAP_MS) : null;
  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), from ? gte(messages.createdAt, from) : undefined))
    .orderBy(asc(messages.createdAt))
    .limit(200);
  const hasNew = rows.some((row) => !after || row.createdAt.getTime() > after.getTime());
  if (hasNew) await markAsRead(actor, conversationId);
  return rows.map((row) => toChatMessage(actor, row));
}

/** Conversa já existente com a outra parte (sem criar nada). */
export async function findConversationIdWith(actor: Actor, counterpartId: string): Promise<string | null> {
  if (!isUuid(counterpartId)) return null;
  const condition =
    actor.role === "PATIENT"
      ? and(eq(conversations.patientId, actor.patientId), eq(conversations.professionalId, counterpartId))
      : actor.role === "PROFESSIONAL"
        ? and(eq(conversations.professionalId, actor.professionalId), eq(conversations.patientId, counterpartId))
        : undefined;
  if (!condition) return null;
  const [row] = await db.select({ id: conversations.id }).from(conversations).where(condition).limit(1);
  return row?.id ?? null;
}

export async function sendMessage(actor: Actor, input: { conversationId: string; body: string }): Promise<ChatMessage> {
  const conversation = await loadConversationFor(actor, input.conversationId);
  const body = (input.body ?? "").trim();
  if (body.length === 0) throw new ValidationError("Escreva uma mensagem.");
  if (body.length > MESSAGE_MAX_LENGTH) throw new ValidationError(`Use no máximo ${MESSAGE_MAX_LENGTH} caracteres.`);
  if (!(await isCounterpartActive(actor, conversation))) {
    throw new ValidationError(
      actor.role === "PATIENT"
        ? "Este profissional não atende mais pela clínica. Para remarcar, escolha outro profissional em Agendar consulta ou fale com a clínica."
        : "Esta conta de paciente está desativada. A conversa ficou só para leitura.",
    );
  }

  const now = new Date();
  const [row] = await db
    .insert(messages)
    .values({ conversationId: conversation.id, senderUserId: actor.userId, kind: "USER", bodyEncrypted: encrypt(body), createdAt: now })
    .returning();
  await db
    .update(conversations)
    .set(actor.role === "PATIENT" ? { lastMessageAt: now, patientLastReadAt: now } : { lastMessageAt: now, professionalLastReadAt: now })
    .where(eq(conversations.id, conversation.id));
  return toChatMessage(actor, row);
}

/** Abre (ou cria) a conversa com a outra parte — exige vínculo de cuidado. */
export async function conversationWith(actor: Actor, counterpartId: string): Promise<string> {
  if (actor.role === "PATIENT") {
    await assertCareRelationship(counterpartId, actor.patientId);
    return ensureConversation(db, actor.patientId, counterpartId);
  }
  if (actor.role === "PROFESSIONAL") {
    await assertCareRelationship(actor.professionalId, counterpartId);
    return ensureConversation(db, counterpartId, actor.professionalId);
  }
  throw new ForbiddenError("O chat é exclusivo entre paciente e profissional.");
}
