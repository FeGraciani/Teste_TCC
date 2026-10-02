import { sql } from "drizzle-orm";
import { index, jsonb, pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, timestamptz, updatedAt } from "../../../shared/infrastructure/database/columns";
import { patientProfiles, professionalProfiles } from "../../identity/infrastructure/schema";
import type { PrivacyFields, PrivacyPresetKey, PrivacyFieldKey } from "../domain/privacy-fields";

/**
 * Política de privacidade do paciente.
 * - professional_id NULL  → configuração padrão (vale para todos os profissionais)
 * - professional_id != NULL → exceção para um profissional específico
 */
export const privacyPolicies = pgTable(
  "privacy_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patientProfiles.id, { onDelete: "cascade" }),
    professionalId: uuid("professional_id").references(() => professionalProfiles.id, { onDelete: "cascade" }),
    preset: text("preset").$type<PrivacyPresetKey>().notNull(),
    fields: jsonb("fields").$type<PrivacyFields>().notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("privacy_policies_default_uq")
      .on(t.patientId)
      .where(sql`${t.professionalId} is null`),
    uniqueIndex("privacy_policies_override_uq")
      .on(t.patientId, t.professionalId)
      .where(sql`${t.professionalId} is not null`),
  ],
);

export const accessRequestStatusEnum = pgEnum("privacy_access_request_status", ["PENDING", "APPROVED", "DECLINED"]);

/**
 * Pedido de um profissional para ver dados que o paciente ocultou
 * (ex.: nome completo e endereço para uma receita de controle especial).
 * Só o paciente pode aprovar.
 */
export const privacyAccessRequests = pgTable(
  "privacy_access_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patientProfiles.id, { onDelete: "cascade" }),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionalProfiles.id, { onDelete: "cascade" }),
    fields: jsonb("fields").$type<PrivacyFieldKey[]>().notNull(),
    reason: text("reason").notNull(),
    status: accessRequestStatusEnum("status").notNull().default("PENDING"),
    createdAt: createdAt(),
    respondedAt: timestamptz("responded_at"),
  },
  (t) => [index("privacy_access_requests_patient_idx").on(t.patientId, t.status)],
);

/**
 * Liberação de UM dado para UM profissional, concedida pelo paciente ao
 * aprovar um pedido de acesso. Vale por cima da configuração vigente
 * (padrão ou exceção) — se o paciente mudar o padrão depois, só os dados
 * liberados continuam visíveis para aquele profissional, até ele revogar.
 */
export const privacyFieldGrants = pgTable(
  "privacy_field_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patientProfiles.id, { onDelete: "cascade" }),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionalProfiles.id, { onDelete: "cascade" }),
    field: text("field").$type<PrivacyFieldKey>().notNull(),
    accessRequestId: uuid("access_request_id").references(() => privacyAccessRequests.id, { onDelete: "set null" }),
    grantedAt: timestamptz("granted_at").notNull().defaultNow(),
    revokedAt: timestamptz("revoked_at"),
  },
  (t) => [
    uniqueIndex("privacy_field_grants_active_uq")
      .on(t.patientId, t.professionalId, t.field)
      .where(sql`${t.revokedAt} is null`),
    index("privacy_field_grants_professional_idx").on(t.professionalId, t.patientId),
  ],
);

export type PrivacyPolicyRow = typeof privacyPolicies.$inferSelect;
export type PrivacyFieldGrantRow = typeof privacyFieldGrants.$inferSelect;
export type PrivacyAccessRequestRow = typeof privacyAccessRequests.$inferSelect;
