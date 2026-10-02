/**
 * Dados de demonstração: equipe, serviços e valores, agenda, pacientes com
 * diferentes níveis de anonimato, prontuários, conversas e um pedido de acesso.
 *
 * ⚠️ APAGA todos os dados do banco de DATABASE_URL antes de inserir.
 * Uso: npm run db:seed
 *
 * Travas de segurança (para nunca apagar dados reais, como prontuários):
 *  - não roda com NODE_ENV=production;
 *  - só roda em banco local (localhost), a não ser que SEED_ALLOW_REMOTE=true;
 *  - recusa se o banco tiver contas fora do domínio de demonstração
 *    (@alento.example). Num banco LOCAL de desenvolvimento, dá para apagar
 *    mesmo assim com: npm run db:seed -- --apagar-tudo
 */
import "dotenv/config";
import { count, notLike, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import { CLINIC_TIME_ZONE } from "../src/config/clinic";
import { DEMO_PASSWORD } from "../src/config/demo";
import { hashPassword } from "../src/modules/identity/domain/password";
import { fieldsForPreset, type NamedPresetKey, type PrivacyFields } from "../src/modules/privacy/domain/privacy-fields";
import { localDateTimeToInstant } from "../src/modules/scheduling/domain/availability";
import { encrypt, encryptJson } from "../src/shared/infrastructure/crypto";
import { db, pool } from "../src/shared/infrastructure/database/client";
import {
  appointments,
  auditLogs,
  clinicalRecords,
  type ClinicalRecordRow,
  conversations,
  messages,
  patientProfiles,
  privacyAccessRequests,
  privacyPolicies,
  professionalProfiles,
  scheduleSettings,
  services,
  timeOffs,
  users,
  weeklyScheduleBlocks,
} from "../src/shared/infrastructure/database/schema";

const DEMO_EMAIL_DOMAIN = "@alento.example";

function refuse(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function isLocalDatabase(url: string): boolean {
  try {
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Confere, ANTES de apagar qualquer coisa, que este banco é mesmo de demonstração. */
async function assertSafeToReset() {
  if (process.env.NODE_ENV === "production") {
    refuse("O seed apaga todos os dados e não roda em produção. Use npm run admin:create para criar o primeiro acesso.");
  }
  const url = process.env.DATABASE_URL ?? "";
  const local = isLocalDatabase(url);
  if (!local && process.env.SEED_ALLOW_REMOTE !== "true") {
    refuse(
      "DATABASE_URL não aponta para um banco local. O seed APAGA tudo; para recriar uma demonstração num banco remoto (nunca o de produção), defina SEED_ALLOW_REMOTE=true.",
    );
  }
  const [real] = await db
    .select({ total: count() })
    .from(users)
    .where(notLike(users.email, `%${DEMO_EMAIL_DOMAIN}`));
  if ((real?.total ?? 0) > 0) {
    if (local && process.argv.includes("--apagar-tudo")) return;
    refuse(
      `O banco tem ${real!.total} conta(s) fora do domínio de demonstração (${DEMO_EMAIL_DOMAIN}). O seed só recria bancos vazios ou de demonstração.` +
        (local ? " Se este é um banco local de desenvolvimento e você quer apagar tudo, rode: npm run db:seed -- --apagar-tudo" : ""),
    );
  }
}

const TZ = CLINIC_TIME_ZONE;
const today = DateTime.now().setZone(TZ).startOf("day");

/** Data civil a `offset` dias de hoje, ajustada para o dia útil permitido mais próximo (para frente ou para trás). */
function dayFrom(offset: number, weekdays: number[] = [1, 2, 3, 4, 5]): string {
  let day = today.plus({ days: offset });
  const step = offset < 0 ? -1 : 1;
  while (!weekdays.includes(day.weekday)) day = day.plus({ days: step });
  return day.toISODate()!;
}

function at(dateKey: string, time: string): Date {
  const instant = localDateTimeToInstant(dateKey, time, TZ);
  if (!instant) throw new Error(`Data inválida: ${dateKey} ${time}`);
  return instant;
}

/** Momento do agendamento: seis dias antes da consulta, nunca no futuro. */
function bookedAtFor(startsAt: Date): Date {
  return new Date(Math.min(startsAt.getTime() - 6 * 24 * 60 * 60 * 1000, Date.now() - 60 * 60 * 1000));
}

const minutes = (clock: string) => {
  const [h, m] = clock.split(":").map(Number);
  return h! * 60 + m!;
};

async function reset() {
  await db.transaction(async (tx) => {
    // O banco bloqueia TRUNCATE do prontuário; só o reset da DEMONSTRAÇÃO liga esta chave, e só nesta transação.
    await tx.execute(sql`SET LOCAL alento.permitir_reset_demo = 'sim'`);
    await tx.execute(sql`
      TRUNCATE TABLE audit_logs, messages, conversations, clinical_records, privacy_field_grants, privacy_access_requests,
        privacy_policies, appointments, time_offs, weekly_schedule_blocks, schedule_settings,
        services, account_tokens, sessions, patient_profiles, professional_profiles, users
      RESTART IDENTITY CASCADE
    `);
  });
}

async function main() {
  await assertSafeToReset();
  console.log("→ Limpando o banco…");
  await reset();
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const passwordSetAt = new Date();

  // ── Serviços e valores ──────────────────────────────────────────────
  console.log("→ Serviços e valores…");
  const serviceRows = await db
    .insert(services)
    .values([
      {
        slug: "sessao-de-acolhimento",
        name: "Sessão de acolhimento",
        description: "Um primeiro encontro para entender o que você procura e indicar o melhor caminho: terapia, psiquiatria ou os dois.",
        specialty: "PSYCHOLOGY",
        durationMinutes: 50,
        priceCents: 15000,
        sortOrder: 1,
      },
      {
        slug: "psicoterapia-individual",
        name: "Psicoterapia individual",
        description: "Sessões semanais ou quinzenais para trabalhar ansiedade, tristeza, luto, relacionamentos e o que mais estiver pesando.",
        specialty: "PSYCHOLOGY",
        durationMinutes: 50,
        priceCents: 22000,
        sortOrder: 2,
      },
      {
        slug: "psicoterapia-de-casal",
        name: "Psicoterapia de casal",
        description: "Um espaço seguro para o casal conversar sobre conflitos, comunicação e decisões importantes.",
        specialty: "PSYCHOLOGY",
        durationMinutes: 80,
        priceCents: 34000,
        sortOrder: 3,
      },
      {
        slug: "primeira-consulta-psiquiatrica",
        name: "Primeira consulta psiquiátrica",
        description: "Avaliação completa da sua história e dos sintomas, com plano de tratamento e, se necessário, prescrição.",
        specialty: "PSYCHIATRY",
        durationMinutes: 60,
        priceCents: 55000,
        sortOrder: 1,
      },
      {
        slug: "consulta-de-retorno",
        name: "Consulta de retorno",
        description: "Acompanhamento do tratamento e ajustes de medicação, para quem já passou pela primeira consulta.",
        specialty: "PSYCHIATRY",
        durationMinutes: 30,
        priceCents: 38000,
        sortOrder: 2,
      },
    ])
    .returning();
  const service = (slug: string) => serviceRows.find((row) => row.slug === slug)!;

  // ── Administração ──────────────────────────────────────────────────
  console.log("→ Contas…");
  const [admin] = await db
    .insert(users)
    .values({ email: "admin@alento.example", name: "Renata Campos", role: "ADMIN", passwordHash, passwordSetAt })
    .returning();

  // ── Profissionais ──────────────────────────────────────────────────
  type ProfessionalSeed = {
    key: string;
    email: string;
    name: string;
    displayName: string;
    specialty: "PSYCHOLOGY" | "PSYCHIATRY";
    title: string;
    registry: string;
    bio: string;
    focusAreas: string[];
    acceptsInPerson?: boolean;
    slotStepMinutes: number;
    blocks: { weekdays: number[]; start: string; end: string; kind: "APPOINTMENTS" | "INTERNAL"; label?: string }[];
  };

  const professionalSeeds: ProfessionalSeed[] = [
    {
      key: "helena",
      email: "helena@alento.example",
      name: "Helena Duarte Ribeiro",
      displayName: "Dra. Helena Duarte",
      specialty: "PSYCHIATRY",
      title: "Psiquiatra",
      registry: "CRM-SP 000101",
      bio: "Psiquiatra com foco em ansiedade e depressão em adultos. Acredita em decisões compartilhadas: cada ajuste de medicação é conversado com calma, no seu tempo.",
      focusAreas: ["Ansiedade", "Depressão", "TDAH em adultos", "Insônia"],
      slotStepMinutes: 30,
      blocks: [
        { weekdays: [1, 3, 5], start: "08:00", end: "12:00", kind: "APPOINTMENTS" },
        { weekdays: [1, 3, 5], start: "14:00", end: "18:00", kind: "APPOINTMENTS" },
        { weekdays: [2], start: "13:00", end: "19:00", kind: "APPOINTMENTS" },
        { weekdays: [4], start: "08:00", end: "10:00", kind: "INTERNAL", label: "Reunião clínica" },
        { weekdays: [4], start: "10:00", end: "16:00", kind: "APPOINTMENTS" },
      ],
    },
    {
      key: "rafael",
      email: "rafael@alento.example",
      name: "Rafael Moreira Lima",
      displayName: "Dr. Rafael Moreira",
      specialty: "PSYCHIATRY",
      title: "Psiquiatra",
      registry: "CRM-SP 000202",
      bio: "Atua com transtorno bipolar, uso problemático de álcool e outras substâncias e saúde mental no trabalho. Atende no fim da tarde para quem não pode sair do expediente.",
      focusAreas: ["Transtorno bipolar", "Dependência química", "Saúde mental no trabalho"],
      slotStepMinutes: 30,
      blocks: [
        { weekdays: [1, 2, 3, 4], start: "13:00", end: "20:00", kind: "APPOINTMENTS" },
        { weekdays: [5], start: "09:00", end: "12:00", kind: "INTERNAL", label: "Estudos de caso" },
      ],
    },
    {
      key: "ana",
      email: "ana@alento.example",
      name: "Ana Beatriz Lima",
      displayName: "Ana Beatriz Lima",
      specialty: "PSYCHOLOGY",
      title: "Psicóloga clínica",
      registry: "CRP 06/000303",
      bio: "Psicóloga com abordagem cognitivo-comportamental. Trabalha com ansiedade, autoestima e luto, com sessões práticas e objetivos combinados juntos.",
      focusAreas: ["Ansiedade", "Autoestima", "Luto", "Terapia cognitivo-comportamental"],
      slotStepMinutes: 60,
      blocks: [
        { weekdays: [1, 2, 3, 4, 5], start: "08:00", end: "12:00", kind: "APPOINTMENTS" },
        { weekdays: [1, 2, 4, 5], start: "14:00", end: "18:00", kind: "APPOINTMENTS" },
        { weekdays: [3], start: "12:00", end: "13:00", kind: "INTERNAL", label: "Supervisão clínica" },
        { weekdays: [3], start: "14:00", end: "18:00", kind: "APPOINTMENTS" },
        { weekdays: [6], start: "08:00", end: "12:00", kind: "APPOINTMENTS" },
      ],
    },
    {
      key: "thiago",
      email: "thiago@alento.example",
      name: "Thiago Nascimento",
      displayName: "Thiago Nascimento",
      specialty: "PSYCHOLOGY",
      title: "Psicólogo clínico",
      registry: "CRP 06/000404",
      bio: "Psicólogo de orientação psicanalítica. Atende online, à noite, com atenção especial a relacionamentos, diversidade e esgotamento profissional.",
      focusAreas: ["Relacionamentos", "Diversidade e LGBTQIA+", "Burnout", "Psicanálise"],
      acceptsInPerson: false,
      slotStepMinutes: 60,
      blocks: [
        { weekdays: [1, 2, 3, 4, 5], start: "17:00", end: "21:00", kind: "APPOINTMENTS" },
        { weekdays: [2], start: "15:00", end: "17:00", kind: "INTERNAL", label: "Supervisão" },
      ],
    },
  ];

  const professionals: Record<string, { id: string; userId: string; displayName: string; specialty: "PSYCHOLOGY" | "PSYCHIATRY" }> = {};
  for (const seed of professionalSeeds) {
    const [user] = await db
      .insert(users)
      .values({ email: seed.email, name: seed.name, role: "PROFESSIONAL", passwordHash, passwordSetAt })
      .returning();
    const [profile] = await db
      .insert(professionalProfiles)
      .values({
        userId: user!.id,
        specialty: seed.specialty,
        displayName: seed.displayName,
        title: seed.title,
        registry: seed.registry,
        bio: seed.bio,
        focusAreas: seed.focusAreas,
        acceptsOnline: true,
        acceptsInPerson: seed.acceptsInPerson ?? true,
      })
      .returning();
    await db.insert(scheduleSettings).values({
      professionalId: profile!.id,
      bufferMinutes: 10,
      slotStepMinutes: seed.slotStepMinutes,
      minNoticeHours: 12,
      bookingWindowDays: 45,
    });
    await db.insert(weeklyScheduleBlocks).values(
      seed.blocks.flatMap((block) =>
        block.weekdays.map((weekday) => ({
          professionalId: profile!.id,
          weekday,
          startMinute: minutes(block.start),
          endMinute: minutes(block.end),
          kind: block.kind,
          label: block.label ?? null,
        })),
      ),
    );
    professionals[seed.key] = { id: profile!.id, userId: user!.id, displayName: seed.displayName, specialty: seed.specialty };
  }

  // ── Pacientes ──────────────────────────────────────────────────────
  type PatientSeed = {
    key: string;
    email: string;
    name: string;
    preferredName?: string;
    pseudonym: string;
    birthDate: string;
    gender?: string;
    pronouns?: string;
    phone?: string;
    city?: string;
    state?: string;
    occupation?: string;
    maritalStatus?: string;
    sensitive: Record<string, string | null>;
    preset: NamedPresetKey;
  };

  const patientSeeds: PatientSeed[] = [
    {
      key: "mariana",
      email: "mariana@alento.example",
      name: "Mariana Souza de Oliveira",
      preferredName: "Mari",
      pseudonym: "Jacarandá-27",
      birthDate: "1993-11-15",
      gender: "Mulher",
      pronouns: "ela/dela",
      phone: "(11) 98888-7777",
      city: "São Paulo",
      state: "SP",
      occupation: "Arquiteta",
      maritalStatus: "Solteira",
      sensitive: {
        cpf: "12345678909",
        address: "Rua das Flores, 100, apto. 42, Pinheiros",
        emergencyContact: "Ana (irmã), (11) 97777-6666",
        mainComplaint: "Crises de ansiedade antes de reuniões e dificuldade para dormir.",
        medications: "Sertralina 50 mg pela manhã",
        allergies: "Dipirona",
        healthHistory: "Episódio depressivo em 2019, tratado com psicoterapia.",
      },
      preset: "DISCREET",
    },
    {
      key: "joao",
      email: "joao@alento.example",
      name: "João Pedro Almeida",
      pseudonym: "Jequitibá-41",
      birthDate: "1988-03-02",
      gender: "Homem",
      pronouns: "ele/dele",
      phone: "(11) 96666-5555",
      city: "Santo André",
      state: "SP",
      occupation: "Engenheiro de software",
      maritalStatus: "Casado",
      sensitive: {
        cpf: null,
        address: null,
        emergencyContact: null,
        mainComplaint: "Desânimo constante e falta de energia há alguns meses.",
        medications: null,
        allergies: "Nenhuma conhecida",
        healthHistory: null,
      },
      preset: "ANONYMOUS",
    },
    {
      key: "carla",
      email: "carla@alento.example",
      name: "Carla Mendes Ferreira",
      pseudonym: "Ipê-63",
      birthDate: "1979-07-21",
      gender: "Mulher",
      pronouns: "ela/dela",
      phone: "(11) 95555-4444",
      city: "São Paulo",
      state: "SP",
      occupation: "Professora",
      maritalStatus: "Divorciada",
      sensitive: {
        cpf: null,
        address: "Av. Paulista, 900, Bela Vista",
        emergencyContact: "Roberto (irmão), (11) 94444-3333",
        mainComplaint: "Insônia e preocupação excessiva depois do divórcio.",
        medications: "Escitalopram 10 mg",
        allergies: null,
        healthHistory: "Hipotireoidismo controlado.",
      },
      preset: "IDENTIFIED",
    },
    {
      key: "lucas",
      email: "lucas@alento.example",
      name: "Lucas Ferreira Santos",
      preferredName: "Luca",
      pseudonym: "Manacá-15",
      birthDate: "2001-01-30",
      gender: "Não binárie",
      pronouns: "elu/delu",
      city: "Osasco",
      state: "SP",
      occupation: "Estudante",
      sensitive: {
        cpf: null,
        address: null,
        emergencyContact: null,
        mainComplaint: "Ansiedade com a faculdade e dificuldade de concentração.",
        medications: null,
        allergies: null,
        healthHistory: null,
      },
      preset: "DISCREET",
    },
  ];

  const patients: Record<string, { id: string; userId: string }> = {};
  for (const seed of patientSeeds) {
    const [user] = await db.insert(users).values({ email: seed.email, name: seed.name, role: "PATIENT", passwordHash, passwordSetAt }).returning();
    const [profile] = await db
      .insert(patientProfiles)
      .values({
        userId: user!.id,
        preferredName: seed.preferredName ?? null,
        pseudonym: seed.pseudonym,
        birthDate: seed.birthDate,
        gender: seed.gender ?? null,
        pronouns: seed.pronouns ?? null,
        phone: seed.phone ?? null,
        city: seed.city ?? null,
        state: seed.state ?? null,
        occupation: seed.occupation ?? null,
        maritalStatus: seed.maritalStatus ?? null,
        sensitiveData: encryptJson(seed.sensitive),
      })
      .returning();
    await db
      .insert(privacyPolicies)
      .values({ patientId: profile!.id, professionalId: null, preset: seed.preset, fields: fieldsForPreset(seed.preset) });
    patients[seed.key] = { id: profile!.id, userId: user!.id };
  }

  // Exceção: Mariana mostra o nome completo e a data de nascimento só para a psiquiatra.
  const marianaForHelena: PrivacyFields = { ...fieldsForPreset("DISCREET"), name: "FULL", birthDate: "FULL" };
  await db.insert(privacyPolicies).values({
    patientId: patients.mariana!.id,
    professionalId: professionals.helena!.id,
    preset: "CUSTOM",
    fields: marianaForHelena,
  });

  // ── Consultas ──────────────────────────────────────────────────────
  console.log("→ Consultas, prontuários e conversas…");
  type AppointmentSeed = {
    key: string;
    patient: string;
    professional: string;
    service: string;
    day: string;
    time: string;
    modality: "ONLINE" | "IN_PERSON";
    status: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
    note?: string;
    cancelReason?: string;
  };

  const anaDays = [1, 2, 3, 4, 5];
  const appointmentSeeds: AppointmentSeed[] = [
    // Mariana com a psicóloga Ana (terças, às 9h) e com a Dra. Helena
    {
      key: "mari-ana-1",
      patient: "mariana",
      professional: "ana",
      service: "sessao-de-acolhimento",
      day: dayFrom(-21, [2]),
      time: "09:00",
      modality: "ONLINE",
      status: "COMPLETED",
      note: "É minha primeira vez em terapia.",
    },
    {
      key: "mari-ana-2",
      patient: "mariana",
      professional: "ana",
      service: "psicoterapia-individual",
      day: dayFrom(-14, [2]),
      time: "09:00",
      modality: "ONLINE",
      status: "COMPLETED",
    },
    {
      key: "mari-helena-1",
      patient: "mariana",
      professional: "helena",
      service: "primeira-consulta-psiquiatrica",
      day: dayFrom(-10, [1, 3, 5]),
      time: "10:00",
      modality: "IN_PERSON",
      status: "COMPLETED",
    },
    {
      key: "mari-ana-3",
      patient: "mariana",
      professional: "ana",
      service: "psicoterapia-individual",
      day: dayFrom(-7, [2]),
      time: "09:00",
      modality: "ONLINE",
      status: "COMPLETED",
    },
    {
      key: "mari-ana-4",
      patient: "mariana",
      professional: "ana",
      service: "psicoterapia-individual",
      day: dayFrom(2, anaDays),
      time: "09:00",
      modality: "ONLINE",
      status: "SCHEDULED",
    },
    {
      key: "mari-helena-2",
      patient: "mariana",
      professional: "helena",
      service: "consulta-de-retorno",
      day: dayFrom(6, [1, 3, 5]),
      time: "14:30",
      modality: "IN_PERSON",
      status: "SCHEDULED",
      note: "Gostaria de conversar sobre o sono.",
    },
    // João (anônimo) com Thiago (online, à noite) e com o Dr. Rafael
    {
      key: "joao-thiago-1",
      patient: "joao",
      professional: "thiago",
      service: "psicoterapia-individual",
      day: dayFrom(-7),
      time: "19:00",
      modality: "ONLINE",
      status: "COMPLETED",
    },
    {
      key: "joao-thiago-2",
      patient: "joao",
      professional: "thiago",
      service: "psicoterapia-individual",
      day: dayFrom(1),
      time: "19:00",
      modality: "ONLINE",
      status: "SCHEDULED",
    },
    {
      key: "joao-rafael-x",
      patient: "joao",
      professional: "rafael",
      service: "primeira-consulta-psiquiatrica",
      day: dayFrom(2, [1, 2, 3, 4]),
      time: "15:00",
      modality: "ONLINE",
      status: "CANCELLED",
      cancelReason: "tive um imprevisto de saúde na família. Peço desculpas pelo transtorno.",
    },
    {
      key: "joao-rafael-1",
      patient: "joao",
      professional: "rafael",
      service: "primeira-consulta-psiquiatrica",
      day: dayFrom(4, [1, 2, 3, 4]),
      time: "16:00",
      modality: "ONLINE",
      status: "SCHEDULED",
    },
    // Carla (identificada) com a Dra. Helena
    {
      key: "carla-helena-1",
      patient: "carla",
      professional: "helena",
      service: "primeira-consulta-psiquiatrica",
      day: dayFrom(-30, [1, 3, 5]),
      time: "15:00",
      modality: "IN_PERSON",
      status: "COMPLETED",
    },
    {
      key: "carla-helena-2",
      patient: "carla",
      professional: "helena",
      service: "consulta-de-retorno",
      day: dayFrom(-3, [1, 3, 5]),
      time: "16:00",
      modality: "IN_PERSON",
      status: "NO_SHOW",
    },
    {
      key: "carla-helena-3",
      patient: "carla",
      professional: "helena",
      service: "consulta-de-retorno",
      day: dayFrom(8, [1, 3, 5]),
      time: "11:00",
      modality: "ONLINE",
      status: "SCHEDULED",
    },
    // Lucas com a Ana: uma consulta passada sem registro de presença e outra futura
    {
      key: "lucas-ana-1",
      patient: "lucas",
      professional: "ana",
      service: "sessao-de-acolhimento",
      day: dayFrom(-1, anaDays),
      time: "15:00",
      modality: "ONLINE",
      status: "SCHEDULED",
    },
    {
      key: "lucas-ana-2",
      patient: "lucas",
      professional: "ana",
      service: "psicoterapia-individual",
      day: dayFrom(3, anaDays),
      time: "10:00",
      modality: "ONLINE",
      status: "SCHEDULED",
    },
  ];

  const createdAppointments: Record<string, { id: string; startsAt: Date }> = {};
  for (const seed of appointmentSeeds) {
    const svc = service(seed.service);
    const startsAt = at(seed.day, seed.time);
    const endsAt = new Date(startsAt.getTime() + svc.durationMinutes * 60_000);
    const bookedAt = bookedAtFor(startsAt);
    const cancelledAt =
      seed.status === "CANCELLED" ? new Date(Math.min(Date.now() - 2 * 60 * 60 * 1000, startsAt.getTime() - 24 * 60 * 60 * 1000)) : null;
    const [row] = await db
      .insert(appointments)
      .values({
        patientId: patients[seed.patient]!.id,
        professionalId: professionals[seed.professional]!.id,
        serviceId: svc.id,
        startsAt,
        endsAt,
        status: seed.status,
        modality: seed.modality,
        priceCents: svc.priceCents,
        patientNote: seed.note ?? null,
        meetingUrl: seed.modality === "ONLINE" ? `https://meet.jit.si/AlentoSala-demo-${seed.key}` : null,
        cancelledAt,
        cancelledByUserId: seed.status === "CANCELLED" ? professionals[seed.professional]!.userId : null,
        cancellationReason: seed.cancelReason ?? null,
        createdAt: bookedAt,
      })
      .returning();
    createdAppointments[seed.key] = { id: row!.id, startsAt };
  }

  // Ausência do Dr. Rafael (congresso) na semana seguinte.
  const congressStart = dayFrom(9, [3]);
  await db.insert(timeOffs).values({
    professionalId: professionals.rafael!.id,
    startsAt: at(congressStart, "00:00"),
    endsAt: at(DateTime.fromISO(congressStart, { zone: TZ }).plus({ days: 2 }).toISODate()!, "23:59"),
    reason: "Congresso Brasileiro de Psiquiatria",
  });

  // ── Prontuários (imutáveis, criptografados) ─────────────────────────
  const hoursAfter = (key: string, hours: number) => new Date(createdAppointments[key]!.startsAt.getTime() + hours * 60 * 60 * 1000);
  type RecordSeed = Omit<ClinicalRecordRow, "id" | "authorSpecialty">;
  const recordSeeds: RecordSeed[] = [
    {
      patientId: patients.mariana!.id,
      authorId: professionals.ana!.id,
      appointmentId: createdAppointments["mari-ana-1"]!.id,
      type: "ANAMNESIS",
      visibility: "CARE_TEAM",
      contentEncrypted: encrypt(
        "Procura atendimento por crises de ansiedade em situações de exposição no trabalho (reuniões, apresentações). Insônia inicial há cerca de dois meses. Nega ideação suicida. Bom suporte familiar (irmã).\n\nObjetivos combinados: reduzir a ansiedade antecipatória e melhorar o sono.",
      ),
      createdAt: hoursAfter("mari-ana-1", 1),
    },
    {
      patientId: patients.mariana!.id,
      authorId: professionals.ana!.id,
      appointmentId: createdAppointments["mari-ana-2"]!.id,
      type: "EVOLUTION",
      visibility: "SAME_SPECIALTY",
      contentEncrypted: encrypt(
        "Psicoeducação sobre o ciclo da ansiedade. Introduzido o registro de pensamentos automáticos. Paciente engajada, trouxe exemplos da semana.",
      ),
      createdAt: hoursAfter("mari-ana-2", 1),
    },
    {
      patientId: patients.mariana!.id,
      authorId: professionals.ana!.id,
      appointmentId: createdAppointments["mari-ana-2"]!.id,
      type: "REFERRAL",
      visibility: "CARE_TEAM",
      contentEncrypted: encrypt(
        "Encaminhada para avaliação psiquiátrica pela persistência da insônia e pela intensidade das crises, apesar da boa adesão à terapia.",
      ),
      createdAt: hoursAfter("mari-ana-2", 1.2),
    },
    {
      patientId: patients.mariana!.id,
      authorId: professionals.helena!.id,
      appointmentId: createdAppointments["mari-helena-1"]!.id,
      type: "PRESCRIPTION",
      visibility: "CARE_TEAM",
      contentEncrypted: encrypt(
        "Avaliação psiquiátrica: quadro compatível com transtorno de ansiedade generalizada, com insônia secundária.\nMantida sertralina 50 mg/dia, já em uso. Orientada higiene do sono. Reavaliar em 30 dias, em conjunto com a psicoterapia.",
      ),
      createdAt: hoursAfter("mari-helena-1", 1.5),
    },
    {
      patientId: patients.mariana!.id,
      authorId: professionals.ana!.id,
      appointmentId: createdAppointments["mari-ana-3"]!.id,
      type: "HANDOFF",
      visibility: "CARE_TEAM",
      contentEncrypted: encrypt(
        "Para quem continuar o cuidado: responde bem a técnicas de TCC (registro de pensamentos, exposição gradual). Principal gatilho: reuniões com a diretoria. Prefere ser chamada de Mari. Remarcações em cima da hora aumentam a ansiedade; avise com antecedência sempre que possível.",
      ),
      createdAt: hoursAfter("mari-ana-3", 1),
    },
    {
      patientId: patients.mariana!.id,
      authorId: professionals.ana!.id,
      appointmentId: createdAppointments["mari-ana-3"]!.id,
      type: "NOTE",
      visibility: "AUTHOR_ONLY",
      contentEncrypted: encrypt("Lembrete pessoal: retomar a hierarquia de exposição na próxima sessão."),
      createdAt: hoursAfter("mari-ana-3", 1.1),
    },
    {
      patientId: patients.joao!.id,
      authorId: professionals.thiago!.id,
      appointmentId: createdAppointments["joao-thiago-1"]!.id,
      type: "EVOLUTION",
      visibility: "CARE_TEAM",
      contentEncrypted: encrypt(
        "Primeira sessão. Relata desânimo e isolamento social nos últimos quatro meses. Sem ideação suicida. Combinado acompanhamento semanal.",
      ),
      createdAt: hoursAfter("joao-thiago-1", 1),
    },
    {
      patientId: patients.joao!.id,
      authorId: professionals.thiago!.id,
      appointmentId: createdAppointments["joao-thiago-1"]!.id,
      type: "HANDOFF",
      visibility: "CARE_TEAM",
      contentEncrypted: encrypt(
        "O paciente optou pelo anonimato. Use sempre o codinome nas conversas e nos registros. Avaliação psiquiátrica pode ajudar no manejo do desânimo.",
      ),
      createdAt: hoursAfter("joao-thiago-1", 1.1),
    },
    {
      patientId: patients.carla!.id,
      authorId: professionals.helena!.id,
      appointmentId: createdAppointments["carla-helena-1"]!.id,
      type: "ANAMNESIS",
      visibility: "CARE_TEAM",
      contentEncrypted: encrypt(
        "Insônia e preocupação excessiva após o divórcio. Hipotireoidismo controlado. Iniciado escitalopram 10 mg. Retorno em quatro semanas.",
      ),
      createdAt: hoursAfter("carla-helena-1", 1),
    },
  ];
  const specialtyOf = (professionalId: string) => Object.values(professionals).find((item) => item.id === professionalId)!.specialty;
  await db.insert(clinicalRecords).values(recordSeeds.map((record) => ({ ...record, authorSpecialty: specialtyOf(record.authorId) })));

  // ── Conversas ──────────────────────────────────────────────────────
  type MessageSeed = { from: "patient" | "professional" | "system"; body: string; at: Date; triggeredBy?: "patient" | "professional" };
  async function conversation(patientKey: string, professionalKey: string, items: MessageSeed[], read: { patient: boolean; professional: boolean }) {
    const sorted = [...items].sort((a, b) => a.at.getTime() - b.at.getTime());
    const last = sorted.at(-1)!.at;
    const [row] = await db
      .insert(conversations)
      .values({
        patientId: patients[patientKey]!.id,
        professionalId: professionals[professionalKey]!.id,
        lastMessageAt: last,
        patientLastReadAt: read.patient ? last : null,
        professionalLastReadAt: read.professional ? last : null,
        createdAt: sorted[0]!.at,
      })
      .returning();
    await db.insert(messages).values(
      sorted.map((item) => {
        const senderKind = item.from === "system" ? item.triggeredBy : item.from;
        return {
          conversationId: row!.id,
          kind: item.from === "system" ? ("SYSTEM" as const) : ("USER" as const),
          senderUserId:
            senderKind === "patient" ? patients[patientKey]!.userId : senderKind === "professional" ? professionals[professionalKey]!.userId : null,
          bodyEncrypted: encrypt(item.body),
          createdAt: item.at,
        };
      }),
    );
  }

  const ago = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);
  const booked = (key: string) => bookedAtFor(createdAppointments[key]!.startsAt);

  await conversation(
    "mariana",
    "ana",
    [
      { from: "system", triggeredBy: "patient", body: "Consulta agendada: Sessão de acolhimento (online).", at: booked("mari-ana-1") },
      { from: "patient", body: "Oi, Ana! Posso levar meu registro de pensamentos impresso na próxima sessão?", at: ago(30) },
      { from: "professional", body: "Claro, Mari! Pode trazer, vamos olhar juntas. Até terça.", at: ago(28) },
      { from: "system", triggeredBy: "patient", body: "Consulta agendada: Psicoterapia individual (online).", at: ago(26) },
    ],
    { patient: true, professional: true },
  );

  await conversation(
    "mariana",
    "helena",
    [
      {
        from: "system",
        triggeredBy: "patient",
        body: "Consulta agendada: Primeira consulta psiquiátrica (presencial).",
        at: booked("mari-helena-1"),
      },
      {
        from: "professional",
        body: "Olá, Mariana. Antes do retorno, anote como está o seu sono durante a semana, por favor. Isso vai nos ajudar a decidir os próximos passos.",
        at: ago(50),
      },
      {
        from: "system",
        triggeredBy: "professional",
        body: 'Dra. Helena Duarte pediu para ver: CPF, Endereço. Motivo: "Preciso emitir uma receita de controle especial." Você decide em Privacidade.',
        at: ago(3),
      },
    ],
    { patient: false, professional: true },
  );

  await conversation(
    "joao",
    "thiago",
    [
      { from: "system", triggeredBy: "patient", body: "Consulta agendada: Psicoterapia individual (online).", at: booked("joao-thiago-1") },
      { from: "patient", body: "Boa noite. Amanhã talvez eu atrase uns 10 minutos por causa do trabalho, tudo bem?", at: ago(5) },
    ],
    { patient: true, professional: false },
  );

  await conversation(
    "joao",
    "rafael",
    [
      { from: "system", triggeredBy: "patient", body: "Consulta agendada: Primeira consulta psiquiátrica (online).", at: booked("joao-rafael-x") },
      {
        from: "system",
        triggeredBy: "professional",
        body: '⚠️ Dr. Rafael Moreira cancelou a consulta. Motivo: "tive um imprevisto de saúde na família. Peço desculpas pelo transtorno." Você pode escolher um novo horário em Agendar consulta.',
        at: ago(20),
      },
      { from: "system", triggeredBy: "patient", body: "Consulta agendada: Primeira consulta psiquiátrica (online).", at: ago(19) },
      { from: "professional", body: "Obrigado pela compreensão. Nos vemos na nova data.", at: ago(18) },
    ],
    { patient: false, professional: true },
  );

  await conversation(
    "carla",
    "helena",
    [{ from: "system", triggeredBy: "patient", body: "Consulta agendada: Consulta de retorno (online).", at: ago(72) }],
    { patient: true, professional: true },
  );

  await conversation(
    "lucas",
    "ana",
    [
      { from: "system", triggeredBy: "patient", body: "Consulta agendada: Sessão de acolhimento (online).", at: booked("lucas-ana-1") },
      { from: "patient", body: "Oi! Uma dúvida: a sessão de acolhimento é pelo vídeo do próprio app?", at: ago(40) },
    ],
    { patient: true, professional: false },
  );

  // Pedido de acesso pendente: a psiquiatra precisa do CPF e do endereço para uma receita.
  await db.insert(privacyAccessRequests).values({
    patientId: patients.mariana!.id,
    professionalId: professionals.helena!.id,
    fields: ["cpf", "location"],
    reason: "Preciso emitir uma receita de controle especial.",
    status: "PENDING",
    createdAt: ago(3),
  });

  // ── Trilha de auditoria (histórico de acessos) ──────────────────────
  const view = (professionalKey: string, patientKey: string, action: "PATIENT_PROFILE_VIEWED" | "CLINICAL_RECORDS_VIEWED", when: Date) => ({
    actorUserId: professionals[professionalKey]!.userId,
    actorRole: "PROFESSIONAL" as const,
    action,
    entityType: action === "PATIENT_PROFILE_VIEWED" ? "patient" : "clinical_record",
    subjectPatientId: patients[patientKey]!.id,
    createdAt: when,
  });
  await db
    .insert(auditLogs)
    .values([
      { actorUserId: admin!.id, actorRole: "ADMIN", action: "AUTH_LOGIN", entityType: "user", entityId: admin!.id, createdAt: ago(80) },
      view("ana", "mariana", "PATIENT_PROFILE_VIEWED", hoursAfter("mari-ana-3", -0.2)),
      view("ana", "mariana", "CLINICAL_RECORDS_VIEWED", hoursAfter("mari-ana-3", -0.2)),
      view("helena", "mariana", "PATIENT_PROFILE_VIEWED", hoursAfter("mari-helena-1", -0.3)),
      view("helena", "mariana", "CLINICAL_RECORDS_VIEWED", hoursAfter("mari-helena-1", -0.3)),
      view("helena", "mariana", "PATIENT_PROFILE_VIEWED", ago(3)),
      view("thiago", "joao", "PATIENT_PROFILE_VIEWED", hoursAfter("joao-thiago-1", -0.1)),
    ]);

  console.log("\n✓ Dados de demonstração prontos. Senha de todas as contas:", DEMO_PASSWORD);
  console.table([
    { perfil: "Administração", email: "admin@alento.example" },
    { perfil: "Psiquiatra", email: "helena@alento.example" },
    { perfil: "Psiquiatra", email: "rafael@alento.example" },
    { perfil: "Psicóloga", email: "ana@alento.example" },
    { perfil: "Psicólogo", email: "thiago@alento.example" },
    { perfil: "Paciente (discreto + exceção)", email: "mariana@alento.example" },
    { perfil: "Paciente (anônimo)", email: "joao@alento.example" },
    { perfil: "Paciente (identificada)", email: "carla@alento.example" },
    { perfil: "Paciente (discreto)", email: "lucas@alento.example" },
  ]);
}

main()
  .catch((error) => {
    console.error("✗ Falha ao gerar dados de demonstração:", error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
