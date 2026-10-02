import { index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt } from "../../../shared/infrastructure/database/columns";
import { patientProfiles, roleEnum, users } from "../../identity/infrastructure/schema";

/**
 * Trilha de auditoria (LGPD): quem fez o quê, quando.
 * subject_patient_id permite mostrar ao paciente quem acessou seus dados.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorRole: roleEnum("actor_role"),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    subjectPatientId: uuid("subject_patient_id").references(() => patientProfiles.id, { onDelete: "cascade" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ipAddress: text("ip_address"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_logs_subject_idx").on(t.subjectPatientId, t.createdAt), index("audit_logs_created_idx").on(t.createdAt)],
);

export type AuditLogRow = typeof auditLogs.$inferSelect;
