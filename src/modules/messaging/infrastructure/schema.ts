import { index, pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, timestamptz } from "../../../shared/infrastructure/database/columns";
import { patientProfiles, professionalProfiles, users } from "../../identity/infrastructure/schema";

export const messageKindEnum = pgEnum("message_kind", ["USER", "SYSTEM"]);

/** Um canal por par paciente ↔ profissional, criado no primeiro agendamento. */
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patientProfiles.id, { onDelete: "cascade" }),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionalProfiles.id, { onDelete: "cascade" }),
    lastMessageAt: timestamptz("last_message_at").notNull().defaultNow(),
    patientLastReadAt: timestamptz("patient_last_read_at"),
    professionalLastReadAt: timestamptz("professional_last_read_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("conversations_pair_uq").on(t.patientId, t.professionalId)],
);

/**
 * Mensagens (conteúdo criptografado).
 * SYSTEM = aviso automático (agendamento, cancelamento, pedido de acesso);
 * nesse caso sender_user_id indica quem provocou o aviso.
 */
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderUserId: uuid("sender_user_id").references(() => users.id, { onDelete: "set null" }),
    kind: messageKindEnum("kind").notNull().default("USER"),
    bodyEncrypted: text("body_encrypted").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("messages_conversation_created_idx").on(t.conversationId, t.createdAt)],
);

export type ConversationRow = typeof conversations.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
