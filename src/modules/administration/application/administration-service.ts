import "server-only";
import { and, asc, count, desc, eq, gte, lt, ne } from "drizzle-orm";
import { z } from "zod";
import { recordAudit } from "@/modules/audit/application/audit-service";
import { sendInvite, type AccountLinkSent } from "@/modules/identity/application/account-access-service";
import { emailSchema } from "@/modules/identity/application/auth-service";
import { destroyAllSessionsOf } from "@/modules/identity/application/session";
import { hashPassword } from "@/modules/identity/domain/password";
import { emailCancellationNotices, type CancellationNotice } from "@/modules/scheduling/application/appointment-emails";
import { DEFAULT_SCHEDULE_SETTINGS } from "@/modules/scheduling/application/availability-service";
import { cancelFutureAppointmentsOf } from "@/modules/scheduling/application/booking-service";
import { canProfessionalCancel, type AppointmentStatus, type Modality } from "@/modules/scheduling/domain/appointment-policy";
import { assertAdmin, type Actor } from "@/shared/application/actor";
import { NotFoundError, ValidationError } from "@/shared/errors";
import { afterResponse } from "@/shared/infrastructure/after-response";
import { randomToken } from "@/shared/infrastructure/crypto";
import { db } from "@/shared/infrastructure/database/client";
import {
  appointments,
  patientProfiles,
  privacyAccessRequests,
  professionalProfiles,
  scheduleSettings,
  services,
  users,
  weeklyScheduleBlocks,
} from "@/shared/infrastructure/database/schema";
import { isUuid, parseOrThrow } from "@/shared/lib/validation";

const DAY = 24 * 60 * 60 * 1000;

export type AdminOverview = {
  activePatients: number;
  activeProfessionals: number;
  appointmentsNext7Days: number;
  completedLast30Days: number;
  cancelledLast30Days: number;
  noShowLast30Days: number;
  pendingAccessRequests: number;
};

/** Indicadores operacionais. Nenhum dado clínico é consultado aqui. */
export async function getAdminOverview(actor: Actor, now: Date = new Date()): Promise<AdminOverview> {
  assertAdmin(actor);
  const since = new Date(now.getTime() - 30 * DAY);
  const until = new Date(now.getTime() + 7 * DAY);

  const countWhere = async (condition: ReturnType<typeof and>, table: "appointments" | "users") => {
    const [row] =
      table === "appointments"
        ? await db.select({ total: count() }).from(appointments).where(condition)
        : await db.select({ total: count() }).from(users).where(condition);
    return row?.total ?? 0;
  };

  const [pending] = await db.select({ total: count() }).from(privacyAccessRequests).where(eq(privacyAccessRequests.status, "PENDING"));

  return {
    activePatients: await countWhere(and(eq(users.role, "PATIENT"), eq(users.active, true)), "users"),
    activeProfessionals: await countWhere(and(eq(users.role, "PROFESSIONAL"), eq(users.active, true)), "users"),
    appointmentsNext7Days: await countWhere(
      and(eq(appointments.status, "SCHEDULED"), gte(appointments.startsAt, now), lt(appointments.startsAt, until)),
      "appointments",
    ),
    completedLast30Days: await countWhere(and(eq(appointments.status, "COMPLETED"), gte(appointments.startsAt, since)), "appointments"),
    cancelledLast30Days: await countWhere(and(eq(appointments.status, "CANCELLED"), gte(appointments.startsAt, since)), "appointments"),
    noShowLast30Days: await countWhere(and(eq(appointments.status, "NO_SHOW"), gte(appointments.startsAt, since)), "appointments"),
    pendingAccessRequests: pending?.total ?? 0,
  };
}

export type AdminAppointment = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  cancellationReason: string | null;
  status: AppointmentStatus;
  modality: Modality;
  priceCents: number;
  serviceName: string;
  professionalName: string;
  patientName: string;
  patientEmail: string;
  /** A administração pode cancelar enquanto a consulta não terminou. */
  canCancel: boolean;
};

/** Consultas para gestão (agenda geral, cobrança). Sem prontuário nem dados clínicos. */
export async function listAppointmentsForAdmin(
  actor: Actor,
  options: { scope: "upcoming" | "recent"; limit?: number },
  now: Date = new Date(),
): Promise<AdminAppointment[]> {
  assertAdmin(actor);
  const patientUser = users;
  const rows = await db
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      cancellationReason: appointments.cancellationReason,
      status: appointments.status,
      modality: appointments.modality,
      priceCents: appointments.priceCents,
      serviceName: services.name,
      professionalName: professionalProfiles.displayName,
      patientName: patientUser.name,
      patientEmail: patientUser.email,
    })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(professionalProfiles, eq(professionalProfiles.id, appointments.professionalId))
    .innerJoin(patientProfiles, eq(patientProfiles.id, appointments.patientId))
    .innerJoin(patientUser, eq(patientUser.id, patientProfiles.userId))
    .where(options.scope === "upcoming" ? and(gte(appointments.startsAt, now), eq(appointments.status, "SCHEDULED")) : lt(appointments.startsAt, now))
    .orderBy(options.scope === "upcoming" ? asc(appointments.startsAt) : desc(appointments.startsAt))
    .limit(options.limit ?? 100);
  return rows.map((row) => ({ ...row, canCancel: canProfessionalCancel(row, now).allowed }));
}

export type AdminProfessional = {
  professionalId: string;
  userId: string;
  displayName: string;
  name: string;
  email: string;
  title: string;
  specialty: "PSYCHOLOGY" | "PSYCHIATRY";
  registry: string;
  bio: string;
  focusAreas: string[];
  active: boolean;
  /** Convite enviado e ainda não aceito (a pessoa nunca criou a senha). */
  pendingInvite: boolean;
  weeklyBlocks: number;
  upcomingAppointments: number;
};

export async function listProfessionalsForAdmin(actor: Actor, now: Date = new Date()): Promise<AdminProfessional[]> {
  assertAdmin(actor);
  const rows = await db
    .select({
      professionalId: professionalProfiles.id,
      userId: users.id,
      displayName: professionalProfiles.displayName,
      name: users.name,
      email: users.email,
      title: professionalProfiles.title,
      specialty: professionalProfiles.specialty,
      registry: professionalProfiles.registry,
      bio: professionalProfiles.bio,
      focusAreas: professionalProfiles.focusAreas,
      active: users.active,
      passwordSetAt: users.passwordSetAt,
    })
    .from(professionalProfiles)
    .innerJoin(users, eq(users.id, professionalProfiles.userId))
    .orderBy(asc(professionalProfiles.displayName));

  return Promise.all(
    rows.map(async ({ passwordSetAt, ...row }) => {
      const [blocks] = await db
        .select({ total: count() })
        .from(weeklyScheduleBlocks)
        .where(eq(weeklyScheduleBlocks.professionalId, row.professionalId));
      const [upcoming] = await db
        .select({ total: count() })
        .from(appointments)
        .where(and(eq(appointments.professionalId, row.professionalId), eq(appointments.status, "SCHEDULED"), gte(appointments.startsAt, now)));
      return { ...row, pendingInvite: passwordSetAt === null, weeklyBlocks: blocks?.total ?? 0, upcomingAppointments: upcoming?.total ?? 0 };
    }),
  );
}

const professionalSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome completo.").max(120),
  displayName: z.string().trim().min(3, "Informe o nome de exibição (ex.: Dra. Ana Lima).").max(80),
  email: emailSchema,
  specialty: z.enum(["PSYCHOLOGY", "PSYCHIATRY"], { error: "Escolha a especialidade." }),
  title: z.string().trim().min(3, "Informe o título (ex.: Psiquiatra).").max(60),
  registry: z
    .string()
    .trim()
    .min(5, "Informe o registro no conselho.")
    .max(40)
    .regex(/^(CRM|CRP)/i, "Comece com CRM (psiquiatria) ou CRP (psicologia)."),
  bio: z.string().trim().max(800).default(""),
  focusAreas: z
    .string()
    .trim()
    .max(300)
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 8),
    ),
});

/**
 * Senha impossível de adivinhar para contas criadas pela clínica: a pessoa só
 * entra depois de criar a PRÓPRIA senha pelo convite enviado ao seu e-mail.
 */
async function unusablePasswordHash(): Promise<string> {
  return hashPassword(`${randomToken(48)}A1`);
}

/**
 * Cadastra um profissional com uma grade inicial (seg–sex, 8h–12h e 14h–18h
 * de atendimento) e envia o convite para ele criar a própria senha.
 * A administração nunca define nem vê a senha do profissional.
 */
export async function createProfessional(
  actor: Actor,
  raw: Record<string, unknown>,
): Promise<{ professionalId: string; userId: string; invite: AccountLinkSent }> {
  assertAdmin(actor);
  const input = parseOrThrow(professionalSchema, raw);
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
  if (existing) throw new ValidationError("Revise os campos destacados.", { email: ["Já existe uma conta com este e-mail."] });

  const passwordHash = await unusablePasswordHash();
  const created = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ email: input.email, name: input.name, passwordHash, passwordSetAt: null, role: "PROFESSIONAL" })
      .returning({ id: users.id });
    const [profile] = await tx
      .insert(professionalProfiles)
      .values({
        userId: user.id,
        specialty: input.specialty,
        displayName: input.displayName,
        title: input.title,
        registry: input.registry.toUpperCase(),
        bio: input.bio,
        focusAreas: input.focusAreas,
      })
      .returning({ id: professionalProfiles.id });
    await tx.insert(scheduleSettings).values({
      professionalId: profile.id,
      ...DEFAULT_SCHEDULE_SETTINGS,
      slotStepMinutes: input.specialty === "PSYCHIATRY" ? 30 : 60,
    });
    const defaultBlocks = [1, 2, 3, 4, 5].flatMap((weekday) => [
      { professionalId: profile.id, weekday, startMinute: 8 * 60, endMinute: 12 * 60, kind: "APPOINTMENTS" as const },
      { professionalId: profile.id, weekday, startMinute: 14 * 60, endMinute: 18 * 60, kind: "APPOINTMENTS" as const },
    ]);
    await tx.insert(weeklyScheduleBlocks).values(defaultBlocks);
    await recordAudit({ actor, action: "PROFESSIONAL_CREATED", entityType: "professional", entityId: profile.id }, tx);
    return { professionalId: profile.id, userId: user.id };
  });
  return { ...created, invite: await sendInvite(actor, created.userId) };
}

export async function updateProfessional(actor: Actor, professionalId: string, raw: Record<string, unknown>): Promise<void> {
  assertAdmin(actor);
  if (!isUuid(professionalId)) throw new NotFoundError("Profissional não encontrado.");
  const input = parseOrThrow(professionalSchema, raw);
  const [profile] = await db
    .select({ userId: professionalProfiles.userId })
    .from(professionalProfiles)
    .where(eq(professionalProfiles.id, professionalId))
    .limit(1);
  if (!profile) throw new NotFoundError("Profissional não encontrado.");

  const [clash] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, input.email), ne(users.id, profile.userId)))
    .limit(1);
  if (clash) throw new ValidationError("Revise os campos destacados.", { email: ["Este e-mail já está em uso."] });

  await db.transaction(async (tx) => {
    await tx.update(users).set({ name: input.name, email: input.email }).where(eq(users.id, profile.userId));
    await tx
      .update(professionalProfiles)
      .set({
        specialty: input.specialty,
        displayName: input.displayName,
        title: input.title,
        registry: input.registry.toUpperCase(),
        bio: input.bio,
        focusAreas: input.focusAreas,
      })
      .where(eq(professionalProfiles.id, professionalId));
    await recordAudit({ actor, action: "PROFESSIONAL_UPDATED", entityType: "professional", entityId: professionalId }, tx);
  });
}

/** Motivo enviado aos pacientes quando o acesso de um profissional é desativado. */
export const DEACTIVATION_CANCELLATION_REASON = "o profissional não está mais atendendo na agenda da clínica";

/**
 * Ativa/desativa o acesso de qualquer conta. Desativar encerra as sessões na
 * hora; no caso de um profissional, também cancela as consultas futuras e
 * avisa cada paciente pelo chat e por e-mail (ninguém vai a uma consulta que
 * não vai acontecer).
 */
export async function setUserActive(
  actor: Actor,
  userId: string,
  active: boolean,
  now: Date = new Date(),
): Promise<{ cancelledAppointments: number }> {
  const admin = assertAdmin(actor);
  if (!isUuid(userId)) throw new NotFoundError("Conta não encontrada.");
  if (admin.userId === userId && !active) throw new ValidationError("Você não pode desativar a própria conta.");

  let notices: CancellationNotice[] = [];
  await db.transaction(async (tx) => {
    const updated = await tx.update(users).set({ active }).where(eq(users.id, userId)).returning({ id: users.id, role: users.role });
    if (updated.length === 0) throw new NotFoundError("Conta não encontrada.");
    if (!active && updated[0]!.role === "PROFESSIONAL") {
      const [profile] = await tx
        .select({ id: professionalProfiles.id })
        .from(professionalProfiles)
        .where(eq(professionalProfiles.userId, userId))
        .limit(1);
      if (profile) notices = await cancelFutureAppointmentsOf(tx, actor, profile.id, DEACTIVATION_CANCELLATION_REASON, now);
    }
    await recordAudit(
      {
        actor,
        action: active ? "USER_ACTIVATED" : "USER_DEACTIVATED",
        entityType: "user",
        entityId: userId,
        metadata: notices.length > 0 ? { cancelledAppointments: notices.length } : undefined,
      },
      tx,
    );
  });
  if (!active) await destroyAllSessionsOf(userId);
  await afterResponse(() => emailCancellationNotices(notices));
  return { cancelledAppointments: notices.length };
}

export type AdminProfessionalDetail = Omit<AdminProfessional, "weeklyBlocks">;

export async function getProfessionalForAdmin(actor: Actor, professionalId: string, now: Date = new Date()): Promise<AdminProfessionalDetail | null> {
  assertAdmin(actor);
  if (!isUuid(professionalId)) return null;
  const [row] = await db
    .select({
      professionalId: professionalProfiles.id,
      userId: users.id,
      displayName: professionalProfiles.displayName,
      name: users.name,
      email: users.email,
      title: professionalProfiles.title,
      specialty: professionalProfiles.specialty,
      registry: professionalProfiles.registry,
      bio: professionalProfiles.bio,
      focusAreas: professionalProfiles.focusAreas,
      active: users.active,
      passwordSetAt: users.passwordSetAt,
    })
    .from(professionalProfiles)
    .innerJoin(users, eq(users.id, professionalProfiles.userId))
    .where(eq(professionalProfiles.id, professionalId))
    .limit(1);
  if (!row) return null;
  const { passwordSetAt, ...rest } = row;
  const [upcoming] = await db
    .select({ total: count() })
    .from(appointments)
    .where(and(eq(appointments.professionalId, professionalId), eq(appointments.status, "SCHEDULED"), gte(appointments.startsAt, now)));
  return { ...rest, pendingInvite: passwordSetAt === null, upcomingAppointments: upcoming?.total ?? 0 };
}

export type AdminAccount = {
  userId: string;
  name: string;
  email: string;
  active: boolean;
  pendingInvite: boolean;
  lastLoginAt: Date | null;
  isMe: boolean;
};

export async function listAdmins(actor: Actor): Promise<AdminAccount[]> {
  const admin = assertAdmin(actor);
  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      active: users.active,
      passwordSetAt: users.passwordSetAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(eq(users.role, "ADMIN"))
    .orderBy(asc(users.name));
  return rows.map(({ passwordSetAt, ...row }) => ({ ...row, pendingInvite: passwordSetAt === null, isMe: row.userId === admin.userId }));
}

const adminSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome completo.").max(120),
  email: emailSchema,
});

/**
 * Nova conta da equipe administrativa (ex.: recepção). Não dá acesso a
 * prontuários. A pessoa recebe um convite por e-mail e cria a própria senha.
 */
export async function createAdmin(actor: Actor, raw: Record<string, unknown>): Promise<{ userId: string; invite: AccountLinkSent }> {
  assertAdmin(actor);
  const input = parseOrThrow(adminSchema, raw);
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
  if (existing) throw new ValidationError("Revise os campos destacados.", { email: ["Já existe uma conta com este e-mail."] });
  const passwordHash = await unusablePasswordHash();
  const [created] = await db
    .insert(users)
    .values({ email: input.email, name: input.name, passwordHash, passwordSetAt: null, role: "ADMIN" })
    .returning({ id: users.id });
  await recordAudit({ actor, action: "ADMIN_CREATED", entityType: "user", entityId: created!.id });
  return { userId: created!.id, invite: await sendInvite(actor, created!.id) };
}

export type AdminPatient = {
  userId: string;
  patientId: string;
  name: string;
  email: string;
  active: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  appointments: number;
};

/** Pacientes para gestão de contas: só dados cadastrais mínimos, nunca clínicos. */
export async function listPatientsForAdmin(actor: Actor): Promise<AdminPatient[]> {
  assertAdmin(actor);
  const rows = await db
    .select({
      userId: users.id,
      patientId: patientProfiles.id,
      name: users.name,
      email: users.email,
      active: users.active,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(patientProfiles)
    .innerJoin(users, eq(users.id, patientProfiles.userId))
    .orderBy(desc(users.createdAt));

  const totals = await db.select({ patientId: appointments.patientId, total: count() }).from(appointments).groupBy(appointments.patientId);
  return rows.map((row) => ({ ...row, appointments: totals.find((item) => item.patientId === row.patientId)?.total ?? 0 }));
}
