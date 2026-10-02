import "server-only";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import type { Role } from "@/modules/identity/domain/roles";
import { assertAdmin, type Actor } from "@/shared/application/actor";
import { toDateKey } from "@/shared/lib/datetime";
import { db, type Executor } from "@/shared/infrastructure/database/client";
import { patientProfiles, professionalProfiles, users } from "@/shared/infrastructure/database/schema";
import { auditLogs } from "../infrastructure/schema";

export const AUDIT_ACTIONS = {
  AUTH_LOGIN: "Entrou no sistema",
  AUTH_LOGIN_FAILED: "Tentativa de login recusada",
  AUTH_LOGOUT: "Saiu do sistema",
  AUTH_SIGNUP: "Criou conta de paciente",
  AUTH_PASSWORD_CHANGED: "Trocou a senha",
  AUTH_PASSWORD_RESET_REQUESTED: "Pediu link para nova senha",
  AUTH_PASSWORD_RESET_COMPLETED: "Definiu nova senha pelo link do e-mail",
  AUTH_INVITE_ACCEPTED: "Criou a senha pelo convite",
  PATIENT_PROFILE_UPDATED: "Atualizou dados pessoais",
  PATIENT_PSEUDONYM_CHANGED: "Trocou o codinome",
  PRIVACY_UPDATED: "Alterou preferências de privacidade",
  PRIVACY_OVERRIDE_REMOVED: "Removeu exceção de privacidade",
  PRIVACY_ACCESS_REQUESTED: "Pediu acesso a dados ocultos",
  PRIVACY_ACCESS_APPROVED: "Aprovou pedido de acesso",
  PRIVACY_ACCESS_DECLINED: "Recusou pedido de acesso",
  PRIVACY_GRANT_REVOKED: "Revogou liberação de dados",
  PATIENT_PROFILE_VIEWED: "Visualizou o perfil do paciente",
  CLINICAL_RECORDS_VIEWED: "Visualizou o prontuário",
  CLINICAL_RECORD_CREATED: "Registrou anotação no prontuário",
  APPOINTMENT_BOOKED: "Agendou consulta",
  APPOINTMENT_CANCELLED: "Cancelou consulta",
  APPOINTMENT_COMPLETED: "Marcou consulta como realizada",
  APPOINTMENT_NO_SHOW: "Registrou falta",
  SCHEDULE_UPDATED: "Alterou horários de trabalho",
  SCHEDULE_SETTINGS_UPDATED: "Alterou regras da agenda",
  TIME_OFF_CREATED: "Registrou ausência",
  TIME_OFF_REMOVED: "Removeu ausência",
  PROFESSIONAL_CREATED: "Cadastrou profissional",
  PROFESSIONAL_UPDATED: "Atualizou profissional",
  PROFESSIONAL_PROFILE_UPDATED: "Atualizou o próprio perfil profissional",
  ADMIN_CREATED: "Cadastrou administrador",
  USER_ACTIVATED: "Reativou acesso",
  USER_DEACTIVATED: "Desativou acesso",
  USER_ACCESS_LINK_SENT: "Enviou link de acesso ao e-mail da pessoa",
  /** Mantido para exibir registros antigos (versões anteriores geravam senha provisória). */
  USER_PASSWORD_RESET: "Gerou senha provisória (versão anterior)",
  SERVICE_SAVED: "Salvou serviço e preço",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

/** Basta saber quem agiu e com qual perfil — qualquer Actor serve. */
export type AuditActor = { userId: string; role: Role; ip?: string | null };

type AuditEntry = {
  actor?: AuditActor | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  subjectPatientId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
};

/** Registra um evento. Nunca guarda conteúdo clínico, apenas metadados. */
export async function recordAudit(entry: AuditEntry, executor: Executor = db): Promise<void> {
  await executor.insert(auditLogs).values({
    actorUserId: entry.actor?.userId ?? null,
    actorRole: entry.actor?.role ?? null,
    action: entry.action,
    entityType: entry.entityType ?? null,
    entityId: entry.entityId ?? null,
    subjectPatientId: entry.subjectPatientId ?? null,
    metadata: entry.metadata ?? null,
    ipAddress: entry.ip ?? entry.actor?.ip ?? null,
  });
}

export type PatientAccessLogEntry = {
  professionalName: string;
  professionalTitle: string;
  day: string;
  lastAt: Date;
  sawProfile: boolean;
  sawRecords: boolean;
};

/**
 * "Quem acessou meus dados": acessos de profissionais ao perfil e ao
 * prontuário do paciente, agrupados por profissional e dia.
 */
export async function listPatientAccessLog(patientId: string, limit = 30): Promise<PatientAccessLogEntry[]> {
  const rows = await db
    .select({
      createdAt: auditLogs.createdAt,
      action: auditLogs.action,
      professionalName: professionalProfiles.displayName,
      professionalTitle: professionalProfiles.title,
      professionalId: professionalProfiles.id,
    })
    .from(auditLogs)
    .innerJoin(professionalProfiles, eq(professionalProfiles.userId, auditLogs.actorUserId))
    .where(
      and(
        eq(auditLogs.subjectPatientId, patientId),
        eq(auditLogs.actorRole, "PROFESSIONAL"),
        inArray(auditLogs.action, ["PATIENT_PROFILE_VIEWED", "CLINICAL_RECORDS_VIEWED"]),
      ),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(500);

  const grouped = new Map<string, PatientAccessLogEntry>();
  for (const row of rows) {
    const day = toDateKey(row.createdAt);
    const key = `${row.professionalId}:${day}`;
    const entry = grouped.get(key) ?? {
      professionalName: row.professionalName,
      professionalTitle: row.professionalTitle,
      day,
      lastAt: row.createdAt,
      sawProfile: false,
      sawRecords: false,
    };
    if (row.action === "PATIENT_PROFILE_VIEWED") entry.sawProfile = true;
    if (row.action === "CLINICAL_RECORDS_VIEWED") entry.sawRecords = true;
    grouped.set(key, entry);
  }
  return [...grouped.values()].slice(0, limit);
}

export type AdminAuditEntry = {
  id: string;
  createdAt: Date;
  action: AuditAction;
  actionLabel: string;
  actorName: string | null;
  actorRole: string | null;
  entityType: string | null;
  ipAddress: string | null;
};

/** Trilha completa para a administração (sem dados clínicos, só metadados). */
export async function listAuditLog(actor: Actor, options: { limit?: number; action?: AuditAction } = {}): Promise<AdminAuditEntry[]> {
  assertAdmin(actor);
  const rows = await db
    .select({
      id: auditLogs.id,
      createdAt: auditLogs.createdAt,
      action: auditLogs.action,
      actorName: users.name,
      actorRole: auditLogs.actorRole,
      entityType: auditLogs.entityType,
      ipAddress: auditLogs.ipAddress,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .where(options.action ? eq(auditLogs.action, options.action) : isNotNull(auditLogs.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(options.limit ?? 200);

  return rows.map((row) => ({
    ...row,
    action: row.action as AuditAction,
    actionLabel: AUDIT_ACTIONS[row.action as AuditAction] ?? row.action,
  }));
}

/** Apenas para testes e relatórios: quantidade de eventos de um tipo sobre um paciente. */
export async function countAuditEvents(action: AuditAction, subjectPatientId: string): Promise<number> {
  const rows = await db
    .select({ id: auditLogs.id })
    .from(auditLogs)
    .innerJoin(patientProfiles, eq(patientProfiles.id, auditLogs.subjectPatientId))
    .where(and(eq(auditLogs.action, action), eq(auditLogs.subjectPatientId, subjectPatientId)));
  return rows.length;
}
