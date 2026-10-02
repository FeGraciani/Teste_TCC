import { eq, sql } from "drizzle-orm";
import { createProfessional as createProfessionalUseCase } from "@/modules/administration/application/administration-service";
import { registerPatient } from "@/modules/identity/application/auth-service";
import { updateOwnProfile } from "@/modules/identity/application/patient-profile-service";
import { hashPassword } from "@/modules/identity/domain/password";
import type { NamedPresetKey } from "@/modules/privacy/domain/privacy-fields";
import { getAvailabilityForBooking } from "@/modules/scheduling/application/availability-service";
import type { WeeklyBlock } from "@/modules/scheduling/domain/availability";
import type { AdminActor, PatientActor, ProfessionalActor } from "@/shared/application/actor";
import { db } from "@/shared/infrastructure/database/client";
import {
  patientProfiles,
  professionalProfiles,
  scheduleSettings,
  services,
  users,
  weeklyScheduleBlocks,
} from "@/shared/infrastructure/database/schema";

/** Segunda-feira, 4 de março de 2030, 9h em São Paulo: o "agora" fixo dos testes. */
export const NOW = new Date("2030-03-04T09:00:00-03:00");

let sequence = 0;
const unique = (prefix: string) => `${prefix}${Date.now().toString(36)}${(sequence += 1)}`;

export async function resetDatabase(): Promise<void> {
  await db.transaction(async (tx) => {
    // O banco bloqueia TRUNCATE do prontuário; o banco de TESTE liga a chave só nesta transação.
    await tx.execute(sql`SET LOCAL alento.permitir_reset_demo = 'sim'`);
    await tx.execute(sql`
      TRUNCATE TABLE audit_logs, messages, conversations, clinical_records, privacy_field_grants, privacy_access_requests,
        privacy_policies, appointments, time_offs, weekly_schedule_blocks, schedule_settings,
        services, account_tokens, sessions, patient_profiles, professional_profiles, users
      RESTART IDENTITY CASCADE
    `);
  });
}

export async function createAdmin(): Promise<AdminActor> {
  const email = `${unique("admin")}@teste.example`;
  const [user] = await db
    .insert(users)
    .values({ email, name: "Admin Teste", role: "ADMIN", passwordHash: await hashPassword("Senha1234"), passwordSetAt: new Date() })
    .returning();
  return { userId: user!.id, name: user!.name, email, role: "ADMIN" };
}

export async function createService(options: { specialty: "PSYCHOLOGY" | "PSYCHIATRY"; durationMinutes?: number; priceCents?: number }) {
  const [row] = await db
    .insert(services)
    .values({
      slug: unique("servico-"),
      name: options.specialty === "PSYCHIATRY" ? "Consulta psiquiátrica" : "Psicoterapia individual",
      description: "Serviço de teste para os testes de integração.",
      specialty: options.specialty,
      durationMinutes: options.durationMinutes ?? 50,
      priceCents: options.priceCents ?? 22000,
    })
    .returning();
  return row!;
}

type ProfessionalOptions = {
  specialty: "PSYCHOLOGY" | "PSYCHIATRY";
  displayName?: string;
  /** Substitui a grade padrão (seg–sex, 8h–12h e 14h–18h). */
  blocks?: WeeklyBlock[];
  slotStepMinutes?: number;
};

export async function createProfessional(options: ProfessionalOptions): Promise<ProfessionalActor & { password: string }> {
  const admin = await createAdmin();
  const email = `${unique("pro")}@teste.example`;
  const displayName = options.displayName ?? (options.specialty === "PSYCHIATRY" ? "Dra. Teste Psiquiatra" : "Teste Psicóloga");
  const password = "Senha1234";
  const { professionalId, userId } = await createProfessionalUseCase(admin, {
    name: `${displayName.replace(/^Dra?\.\s*/, "")} da Silva`,
    displayName,
    email,
    specialty: options.specialty,
    title: options.specialty === "PSYCHIATRY" ? "Psiquiatra" : "Psicóloga clínica",
    registry: options.specialty === "PSYCHIATRY" ? "CRM-SP 000999" : "CRP 06/000999",
    bio: "",
    focusAreas: "",
  });
  // Atalho de teste: equivale ao profissional aceitar o convite e criar a senha (o fluxo real é testado em account-links.test.ts).
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(password), passwordSetAt: new Date() })
    .where(eq(users.id, userId));

  if (options.blocks) {
    await db.delete(weeklyScheduleBlocks).where(eq(weeklyScheduleBlocks.professionalId, professionalId));
    if (options.blocks.length) {
      await db.insert(weeklyScheduleBlocks).values(options.blocks.map((block) => ({ ...block, label: block.label ?? null, professionalId })));
    }
  }
  if (options.slotStepMinutes) {
    await db.update(scheduleSettings).set({ slotStepMinutes: options.slotStepMinutes }).where(eq(scheduleSettings.professionalId, professionalId));
  }

  const [row] = await db
    .select({ userId: professionalProfiles.userId, name: users.name })
    .from(professionalProfiles)
    .innerJoin(users, eq(users.id, professionalProfiles.userId))
    .where(eq(professionalProfiles.id, professionalId));
  return {
    role: "PROFESSIONAL",
    userId: row!.userId,
    name: row!.name,
    email,
    professionalId,
    specialty: options.specialty,
    displayName,
    password,
  };
}

type PatientOptions = {
  name?: string;
  preset?: NamedPresetKey;
  /** Dados do perfil (o que for informado é gravado como o próprio paciente faria). */
  profile?: Record<string, string>;
};

export async function createPatient(options: PatientOptions = {}): Promise<PatientActor & { password: string }> {
  const email = `${unique("paciente")}@teste.example`;
  const name = options.name ?? "Paciente de Teste";
  const password = "Senha1234";
  const { userId } = await registerPatient(
    {
      name,
      email,
      password,
      passwordConfirmation: password,
      birthDate: "1990-05-10",
      privacyPreset: options.preset ?? "DISCREET",
      acceptTerms: "on",
    },
    null,
  );
  const [profile] = await db.select({ id: patientProfiles.id }).from(patientProfiles).where(eq(patientProfiles.userId, userId));
  const actor: PatientActor = { role: "PATIENT", userId, name, email, patientId: profile!.id };
  if (options.profile) await updateOwnProfile(actor, { name, birthDate: "1990-05-10", ...options.profile });
  return { ...actor, password };
}

/**
 * Horário livre (ISO) de um profissional para um serviço, a partir de NOW.
 * @param skip quantos horários livres pular (útil para o mesmo paciente não cair em dois horários iguais).
 */
export async function firstFreeSlot(professionalId: string, serviceId: string, skip = 0, now: Date = NOW): Promise<string> {
  const availability = await getAvailabilityForBooking({ professionalId, serviceId }, now);
  const slot = availability.days.flatMap((day) => day.slots)[skip];
  if (!slot) throw new Error("Nenhum horário livre encontrado para o teste.");
  return slot.startsAt;
}

/** Grade simples: só terça (ISO 2), das 10h às 12h atendimento e 13h às 14h trabalho interno. */
export const TUESDAY_ONLY: WeeklyBlock[] = [
  { weekday: 2, startMinute: 10 * 60, endMinute: 12 * 60, kind: "APPOINTMENTS" },
  { weekday: 2, startMinute: 13 * 60, endMinute: 14 * 60, kind: "INTERNAL", label: "Supervisão" },
];
