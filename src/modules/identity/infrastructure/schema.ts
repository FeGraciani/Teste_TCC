import { sql } from "drizzle-orm";
import { boolean, date, index, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, timestamptz, updatedAt } from "../../../shared/infrastructure/database/columns";

export const roleEnum = pgEnum("role", ["PATIENT", "PROFESSIONAL", "ADMIN"]);
export const specialtyEnum = pgEnum("specialty", ["PSYCHOLOGY", "PSYCHIATRY"]);

/** Conta de acesso (paciente, profissional ou administrador). */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  /** Nome civil completo. Para pacientes, o que o profissional vê depende das preferências de privacidade. */
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  /**
   * Quando a PRÓPRIA pessoa definiu a senha atual. Nulo = convite ainda não
   * aceito (contas criadas pela administração começam sem senha utilizável).
   */
  passwordSetAt: timestamptz("password_set_at"),
  lastLoginAt: timestamptz("last_login_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Sessões persistidas no banco: podem ser revogadas a qualquer momento. */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** SHA-256 do token do cookie — o token em si nunca é armazenado. */
    tokenHash: text("token_hash").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamptz("expires_at").notNull(),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const accountTokenPurposeEnum = pgEnum("account_token_purpose", ["INVITE", "PASSWORD_RESET"]);

/**
 * Links de uso único enviados por e-mail ao DONO da conta: convite para criar
 * a senha (profissionais e administração) e redefinição de senha.
 * Ninguém da clínica vê ou define a senha de outra pessoa.
 */
export const accountTokens = pgTable(
  "account_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: accountTokenPurposeEnum("purpose").notNull(),
    /** SHA-256 do token do link — o token em si só existe no e-mail enviado. */
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamptz("expires_at").notNull(),
    usedAt: timestamptz("used_at"),
    /** Quem pediu o envio (administração); null quando a própria pessoa pediu. */
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("account_tokens_user_idx").on(t.userId)],
);

/** Dados pessoais do paciente. Campos clínicos ficam criptografados em sensitive_data. */
export const patientProfiles = pgTable("patient_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Como a pessoa prefere ser chamada (nome social ou apelido). */
  preferredName: text("preferred_name"),
  /** Codinome usado no modo anônimo (ex.: "Jacarandá-27"). */
  pseudonym: text("pseudonym").notNull().unique(),
  birthDate: date("birth_date", { mode: "string" }),
  gender: text("gender"),
  pronouns: text("pronouns"),
  phone: text("phone"),
  city: text("city"),
  state: text("state"),
  occupation: text("occupation"),
  maritalStatus: text("marital_status"),
  /**
   * JSON criptografado (AES-256-GCM) com: CPF, endereço, contato de emergência,
   * motivo da busca, medicações, alergias e histórico de saúde.
   */
  sensitiveData: text("sensitive_data"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Perfil público e profissional de psicólogos e psiquiatras. */
export const professionalProfiles = pgTable("professional_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  specialty: specialtyEnum("specialty").notNull(),
  /** Nome de exibição, ex.: "Dra. Helena Duarte". */
  displayName: text("display_name").notNull(),
  /** Ex.: "Psiquiatra", "Psicóloga clínica". */
  title: text("title").notNull(),
  /** Registro no conselho: "CRM-SP 123456" ou "CRP 06/123456". */
  registry: text("registry").notNull(),
  bio: text("bio").notNull().default(""),
  focusAreas: text("focus_areas")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  acceptsOnline: boolean("accepts_online").notNull().default(true),
  acceptsInPerson: boolean("accepts_in_person").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type UserRow = typeof users.$inferSelect;
export type AccountTokenRow = typeof accountTokens.$inferSelect;
export type PatientProfileRow = typeof patientProfiles.$inferSelect;
export type ProfessionalProfileRow = typeof professionalProfiles.$inferSelect;
