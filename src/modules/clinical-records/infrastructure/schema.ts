import { index, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt } from "../../../shared/infrastructure/database/columns";
import { patientProfiles, professionalProfiles, specialtyEnum } from "../../identity/infrastructure/schema";
import { appointments } from "../../scheduling/infrastructure/schema";

export const clinicalRecordTypeEnum = pgEnum("clinical_record_type", ["ANAMNESIS", "EVOLUTION", "HANDOFF", "PRESCRIPTION", "REFERRAL", "NOTE"]);

export const clinicalRecordVisibilityEnum = pgEnum("clinical_record_visibility", ["CARE_TEAM", "SAME_SPECIALTY", "AUTHOR_ONLY"]);

/**
 * Prontuário. Registros são imutáveis (não há UPDATE nem DELETE na aplicação):
 * correções são feitas com uma nova anotação. O conteúdo é criptografado.
 * Nunca é exibido ao paciente pela interface do app.
 */
export const clinicalRecords = pgTable(
  "clinical_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patientProfiles.id, { onDelete: "restrict" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => professionalProfiles.id, { onDelete: "restrict" }),
    /**
     * Especialidade do autor NO MOMENTO do registro. A regra "só minha
     * especialidade" usa este valor, e não o cadastro atual do autor: se a
     * administração corrigir a especialidade de alguém, quem lia continua lendo.
     */
    authorSpecialty: specialtyEnum("author_specialty").notNull(),
    appointmentId: uuid("appointment_id").references(() => appointments.id, { onDelete: "set null" }),
    type: clinicalRecordTypeEnum("type").notNull(),
    visibility: clinicalRecordVisibilityEnum("visibility").notNull().default("CARE_TEAM"),
    contentEncrypted: text("content_encrypted").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("clinical_records_patient_idx").on(t.patientId, t.createdAt)],
);

export type ClinicalRecordRow = typeof clinicalRecords.$inferSelect;
