import "server-only";
import { and, count, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { CLINIC_TIME_ZONE } from "@/config/clinic";
import { listPatientAccessLog, recordAudit, type PatientAccessLogEntry } from "@/modules/audit/application/audit-service";
import { loadPatientPersonalData } from "@/modules/identity/application/patient-profile-service";
import { postSystemMessage } from "@/modules/messaging/application/system-messages";
import { assertCareRelationship, careTeamOf } from "@/modules/scheduling/application/care-relationship";
import { todayKey } from "@/modules/scheduling/domain/availability";
import { assertPatient, assertProfessional, type Actor } from "@/shared/application/actor";
import { ConflictError, NotFoundError, ValidationError } from "@/shared/errors";
import { db, type Executor } from "@/shared/infrastructure/database/client";
import { patientProfiles, professionalProfiles, users } from "@/shared/infrastructure/database/schema";
import { isUuid, parseOrThrow } from "@/shared/lib/validation";
import {
  PRIVACY_FIELDS,
  PRIVACY_FIELD_KEYS,
  detectPreset,
  fieldsForPreset,
  isFullyRevealed,
  isValidLevel,
  revealFields,
  sanitizeFields,
  type PrivacyFieldKey,
  type PrivacyFields,
  type PrivacyPresetKey,
} from "../domain/privacy-fields";
import {
  displayNameFor,
  monogramFor,
  projectPatientForProfessional,
  type PatientPersonalData,
  type ProfessionalPatientView,
} from "../domain/projection";
import { privacyAccessRequests, privacyFieldGrants, privacyPolicies } from "../infrastructure/schema";
import { findActiveGrantsForPatients, findOverride, resolvePolicy, upsertPolicy } from "./policy-store";

export type PatientNameInfo = { displayName: string; monogram: string; preset: PrivacyPresetKey };

/**
 * Como cada paciente aparece para um profissional em listas (agenda, chat,
 * pacientes). Resolve em lote, respeitando exceções por profissional.
 */
export async function resolveDisplayNames(
  professionalId: string,
  patientIds: readonly string[],
  executor: Executor = db,
): Promise<Map<string, PatientNameInfo>> {
  const ids = [...new Set(patientIds)];
  const result = new Map<string, PatientNameInfo>();
  if (ids.length === 0) return result;

  const people = await executor
    .select({
      id: patientProfiles.id,
      fullName: users.name,
      preferredName: patientProfiles.preferredName,
      pseudonym: patientProfiles.pseudonym,
    })
    .from(patientProfiles)
    .innerJoin(users, eq(users.id, patientProfiles.userId))
    .where(inArray(patientProfiles.id, ids));

  const policies = await executor
    .select({ patientId: privacyPolicies.patientId, professionalId: privacyPolicies.professionalId, fields: privacyPolicies.fields })
    .from(privacyPolicies)
    .where(
      and(inArray(privacyPolicies.patientId, ids), or(isNull(privacyPolicies.professionalId), eq(privacyPolicies.professionalId, professionalId))),
    );

  const grants = await findActiveGrantsForPatients(ids, professionalId, executor);

  for (const person of people) {
    const override = policies.find((policy) => policy.patientId === person.id && policy.professionalId === professionalId);
    const fallback = policies.find((policy) => policy.patientId === person.id && policy.professionalId === null);
    const configured = sanitizeFields(override?.fields ?? fallback?.fields ?? fieldsForPreset("ANONYMOUS"));
    const fields = revealFields(configured, grants.get(person.id) ?? []);
    result.set(person.id, {
      displayName: displayNameFor(person, fields.name),
      monogram: monogramFor(person, fields.name),
      preset: detectPreset(fields),
    });
  }
  return result;
}

export type CareTeamMember = {
  professionalId: string;
  displayName: string;
  title: string;
  specialty: "PSYCHOLOGY" | "PSYCHIATRY";
  hasOverride: boolean;
  overrideFields: PrivacyFields | null;
  /** Dados liberados a este profissional por pedido aprovado (valem por cima da configuração). */
  grantedFields: PrivacyFieldKey[];
};

export type ActiveGrantGroup = {
  professionalId: string;
  professionalName: string;
  professionalTitle: string;
  fields: { key: PrivacyFieldKey; label: string; grantedAt: Date }[];
};

export type AccessRequestView = {
  id: string;
  professionalName: string;
  professionalTitle: string;
  fieldLabels: string[];
  reason: string;
  createdAt: Date;
};

export type PrivacyOverview = {
  personalData: PatientPersonalData;
  defaultFields: PrivacyFields;
  careTeam: CareTeamMember[];
  otherProfessionals: CareTeamMember[];
  pendingRequests: AccessRequestView[];
  /** Liberações por pedido ainda ativas, agrupadas por profissional. */
  activeGrants: ActiveGrantGroup[];
  accessLog: PatientAccessLogEntry[];
};

/** Tudo o que a tela "Sua privacidade" precisa. */
export async function getPrivacyOverview(actor: Actor): Promise<PrivacyOverview> {
  const patient = assertPatient(actor);
  const personalData = await loadPatientPersonalData(patient.patientId);
  if (!personalData) throw new NotFoundError("Perfil não encontrado.");

  const policies = await db.select().from(privacyPolicies).where(eq(privacyPolicies.patientId, patient.patientId));
  const defaultPolicy = policies.find((policy) => policy.professionalId === null);
  const overrides = new Map(
    policies.filter((policy) => policy.professionalId).map((policy) => [policy.professionalId!, sanitizeFields(policy.fields)]),
  );

  const teamIds = new Set(await careTeamOf(patient.patientId));
  const professionals = await db
    .select({
      professionalId: professionalProfiles.id,
      displayName: professionalProfiles.displayName,
      title: professionalProfiles.title,
      specialty: professionalProfiles.specialty,
      active: users.active,
    })
    .from(professionalProfiles)
    .innerJoin(users, eq(users.id, professionalProfiles.userId))
    .orderBy(professionalProfiles.displayName);

  const grantRows = await db
    .select({ professionalId: privacyFieldGrants.professionalId, field: privacyFieldGrants.field, grantedAt: privacyFieldGrants.grantedAt })
    .from(privacyFieldGrants)
    .where(and(eq(privacyFieldGrants.patientId, patient.patientId), isNull(privacyFieldGrants.revokedAt)))
    .orderBy(privacyFieldGrants.grantedAt);
  const validGrants = grantRows.filter((row) => row.field in PRIVACY_FIELDS);
  const grantedFieldsOf = (professionalId: string) =>
    validGrants.filter((row) => row.professionalId === professionalId).map((row) => row.field as PrivacyFieldKey);

  const toMember = (professional: (typeof professionals)[number]): CareTeamMember => ({
    professionalId: professional.professionalId,
    displayName: professional.displayName,
    title: professional.title,
    specialty: professional.specialty,
    hasOverride: overrides.has(professional.professionalId),
    overrideFields: overrides.get(professional.professionalId) ?? null,
    grantedFields: grantedFieldsOf(professional.professionalId),
  });

  const activeGrants: ActiveGrantGroup[] = [];
  for (const row of validGrants) {
    let group = activeGrants.find((item) => item.professionalId === row.professionalId);
    if (!group) {
      const professional = professionals.find((item) => item.professionalId === row.professionalId);
      if (!professional) continue;
      group = { professionalId: row.professionalId, professionalName: professional.displayName, professionalTitle: professional.title, fields: [] };
      activeGrants.push(group);
    }
    const key = row.field as PrivacyFieldKey;
    group.fields.push({ key, label: PRIVACY_FIELDS[key].label, grantedAt: row.grantedAt });
  }

  const requests = await db
    .select({
      id: privacyAccessRequests.id,
      fields: privacyAccessRequests.fields,
      reason: privacyAccessRequests.reason,
      createdAt: privacyAccessRequests.createdAt,
      professionalName: professionalProfiles.displayName,
      professionalTitle: professionalProfiles.title,
    })
    .from(privacyAccessRequests)
    .innerJoin(professionalProfiles, eq(professionalProfiles.id, privacyAccessRequests.professionalId))
    .where(and(eq(privacyAccessRequests.patientId, patient.patientId), eq(privacyAccessRequests.status, "PENDING")))
    .orderBy(desc(privacyAccessRequests.createdAt));

  return {
    personalData,
    defaultFields: sanitizeFields(defaultPolicy?.fields ?? fieldsForPreset("ANONYMOUS")),
    careTeam: professionals.filter((p) => teamIds.has(p.professionalId)).map(toMember),
    otherProfessionals: professionals.filter((p) => !teamIds.has(p.professionalId) && p.active).map(toMember),
    pendingRequests: requests.map((request) => ({
      ...request,
      fieldLabels: request.fields.filter((key) => key in PRIVACY_FIELDS).map((key) => PRIVACY_FIELDS[key].label),
    })),
    activeGrants,
    accessLog: await listPatientAccessLog(patient.patientId),
  };
}

function parseFields(raw: unknown): PrivacyFields {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const problems: string[] = [];
  for (const key of PRIVACY_FIELD_KEYS) {
    if (!isValidLevel(key, source[key])) problems.push(`Escolha uma opção para "${PRIVACY_FIELDS[key].label}".`);
  }
  if (problems.length) throw new ValidationError(problems[0], { fields: problems });
  return sanitizeFields(source);
}

/** Salva a configuração padrão (professionalId = null) ou a exceção de um profissional. */
export async function savePrivacySettings(actor: Actor, input: { professionalId: string | null; fields: unknown }): Promise<void> {
  const patient = assertPatient(actor);
  const fields = parseFields(input.fields);

  if (input.professionalId) {
    if (!isUuid(input.professionalId)) throw new NotFoundError("Profissional não encontrado.");
    const [professional] = await db
      .select({ id: professionalProfiles.id })
      .from(professionalProfiles)
      .where(eq(professionalProfiles.id, input.professionalId))
      .limit(1);
    if (!professional) throw new NotFoundError("Profissional não encontrado.");
  }

  await db.transaction(async (tx) => {
    await upsertPolicy(tx, patient.patientId, input.professionalId, fields);
    await recordAudit(
      {
        actor,
        action: "PRIVACY_UPDATED",
        subjectPatientId: patient.patientId,
        entityType: "privacy_policy",
        metadata: { scope: input.professionalId ?? "default", preset: detectPreset(fields) },
      },
      tx,
    );
  });
}

export async function removePrivacyOverride(actor: Actor, professionalId: string): Promise<void> {
  const patient = assertPatient(actor);
  if (!isUuid(professionalId)) throw new NotFoundError("Exceção não encontrada.");
  await db.delete(privacyPolicies).where(and(eq(privacyPolicies.patientId, patient.patientId), eq(privacyPolicies.professionalId, professionalId)));
  await recordAudit({ actor, action: "PRIVACY_OVERRIDE_REMOVED", subjectPatientId: patient.patientId, metadata: { professionalId } });
}

export type ProfessionalPatientProfile = {
  patientId: string;
  view: ProfessionalPatientView;
  policySource: "override" | "default";
  /** Campos que o paciente ainda não mostra por completo (podem ser pedidos). */
  requestableFields: { key: PrivacyFieldKey; label: string }[];
  pendingRequest: { createdAt: Date; fieldLabels: string[] } | null;
};

/**
 * O que um profissional vê de um paciente. Exige vínculo de cuidado e
 * registra o acesso na trilha de auditoria (visível para o paciente).
 */
export async function getPatientProfileForProfessional(actor: Actor, patientId: string): Promise<ProfessionalPatientProfile> {
  const professional = assertProfessional(actor);
  await assertCareRelationship(professional.professionalId, patientId);

  const data = await loadPatientPersonalData(patientId);
  if (!data) throw new NotFoundError("Paciente não encontrado.");
  const policy = await resolvePolicy(patientId, professional.professionalId);
  const view = projectPatientForProfessional(data, policy.fields, todayKey(CLINIC_TIME_ZONE));

  const [pending] = await db
    .select({ createdAt: privacyAccessRequests.createdAt, fields: privacyAccessRequests.fields })
    .from(privacyAccessRequests)
    .where(
      and(
        eq(privacyAccessRequests.patientId, patientId),
        eq(privacyAccessRequests.professionalId, professional.professionalId),
        eq(privacyAccessRequests.status, "PENDING"),
      ),
    )
    .limit(1);

  await recordAudit({ actor, action: "PATIENT_PROFILE_VIEWED", subjectPatientId: patientId, entityType: "patient", entityId: patientId });

  return {
    patientId,
    view,
    policySource: policy.source,
    requestableFields: PRIVACY_FIELD_KEYS.filter((key) => !isFullyRevealed(policy.fields, key)).map((key) => ({
      key,
      label: PRIVACY_FIELDS[key].label,
    })),
    pendingRequest: pending ? { createdAt: pending.createdAt, fieldLabels: pending.fields.map((key) => PRIVACY_FIELDS[key]?.label ?? key) } : null,
  };
}

const accessRequestSchema = z.object({
  patientId: z.uuid(),
  fields: z.array(z.enum(PRIVACY_FIELD_KEYS as [PrivacyFieldKey, ...PrivacyFieldKey[]])).min(1, "Escolha ao menos um dado."),
  reason: z.string().trim().min(10, "Explique ao paciente, em uma frase, por que precisa desses dados.").max(300),
});

/** Profissional pede ao paciente para ver dados ocultos (ex.: receita de controle especial). */
export async function requestFieldAccess(actor: Actor, raw: unknown): Promise<void> {
  const professional = assertProfessional(actor);
  const input = parseOrThrow(accessRequestSchema, raw);
  await assertCareRelationship(professional.professionalId, input.patientId);

  const policy = await resolvePolicy(input.patientId, professional.professionalId);
  const fields = [...new Set(input.fields)].filter((key) => !isFullyRevealed(policy.fields, key));
  if (fields.length === 0) throw new ValidationError("Esses dados já estão visíveis para você.");

  const [pending] = await db
    .select({ id: privacyAccessRequests.id })
    .from(privacyAccessRequests)
    .where(
      and(
        eq(privacyAccessRequests.patientId, input.patientId),
        eq(privacyAccessRequests.professionalId, professional.professionalId),
        eq(privacyAccessRequests.status, "PENDING"),
      ),
    )
    .limit(1);
  if (pending) throw new ConflictError("Já existe um pedido seu aguardando resposta deste paciente.");

  const labels = fields.map((key) => PRIVACY_FIELDS[key].label);
  await db.transaction(async (tx) => {
    const [request] = await tx
      .insert(privacyAccessRequests)
      .values({ patientId: input.patientId, professionalId: professional.professionalId, fields, reason: input.reason })
      .returning({ id: privacyAccessRequests.id });
    await postSystemMessage(tx, {
      patientId: input.patientId,
      professionalId: professional.professionalId,
      triggeredByUserId: professional.userId,
      text: `${professional.displayName} pediu para ver: ${labels.join(", ")}. Motivo: "${input.reason}". Você decide em Privacidade.`,
    });
    await recordAudit(
      {
        actor,
        action: "PRIVACY_ACCESS_REQUESTED",
        subjectPatientId: input.patientId,
        entityType: "privacy_access_request",
        entityId: request.id,
        metadata: { fields },
      },
      tx,
    );
  });
}

/** Paciente aprova (libera os dados só para aquele profissional) ou recusa. */
export async function respondToAccessRequest(actor: Actor, input: { requestId: string; approve: boolean }): Promise<void> {
  const patient = assertPatient(actor);
  if (!isUuid(input.requestId)) throw new NotFoundError("Este pedido não existe ou já foi respondido.");
  const [request] = await db
    .select({ request: privacyAccessRequests, professionalName: professionalProfiles.displayName })
    .from(privacyAccessRequests)
    .innerJoin(professionalProfiles, eq(professionalProfiles.id, privacyAccessRequests.professionalId))
    .where(
      and(
        eq(privacyAccessRequests.id, input.requestId),
        eq(privacyAccessRequests.patientId, patient.patientId),
        eq(privacyAccessRequests.status, "PENDING"),
      ),
    )
    .limit(1);
  if (!request) throw new NotFoundError("Este pedido não existe ou já foi respondido.");

  const { professionalId, fields } = request.request;
  const labels = fields.map((key) => PRIVACY_FIELDS[key]?.label ?? key);

  await db.transaction(async (tx) => {
    if (input.approve) {
      // Libera SÓ os dados pedidos, SÓ para este profissional, por cima da configuração vigente.
      // Nada é congelado: se o paciente mudar o padrão depois, o resto acompanha; a liberação vale até ser revogada.
      const validFields = fields.filter((key) => key in PRIVACY_FIELDS);
      if (validFields.length > 0) {
        await tx
          .insert(privacyFieldGrants)
          .values(validFields.map((field) => ({ patientId: patient.patientId, professionalId, field, accessRequestId: input.requestId })))
          .onConflictDoNothing();
      }
    }
    await tx
      .update(privacyAccessRequests)
      .set({ status: input.approve ? "APPROVED" : "DECLINED", respondedAt: new Date() })
      .where(eq(privacyAccessRequests.id, input.requestId));
    await postSystemMessage(tx, {
      patientId: patient.patientId,
      professionalId,
      triggeredByUserId: patient.userId,
      text: input.approve
        ? `Pedido aprovado: ${labels.join(", ")} agora ${labels.length === 1 ? "está visível" : "estão visíveis"} para ${request.professionalName}, até o paciente revogar.`
        : `Pedido não aprovado: ${labels.join(", ")} continuam ocultos.`,
    });
    await recordAudit(
      {
        actor,
        action: input.approve ? "PRIVACY_ACCESS_APPROVED" : "PRIVACY_ACCESS_DECLINED",
        subjectPatientId: patient.patientId,
        entityType: "privacy_access_request",
        entityId: input.requestId,
        metadata: { professionalId, fields },
      },
      tx,
    );
  });
}

/**
 * Paciente revoga liberações feitas por pedido: um dado específico ou todos
 * os dados liberados para aquele profissional. O profissional é avisado pelo chat.
 */
export async function revokeFieldGrants(actor: Actor, input: { professionalId: string; field?: string | null }): Promise<number> {
  const patient = assertPatient(actor);
  if (!isUuid(input.professionalId)) throw new NotFoundError("Liberação não encontrada.");
  const field = input.field ? input.field : null;
  if (field && !(field in PRIVACY_FIELDS)) throw new NotFoundError("Liberação não encontrada.");

  return db.transaction(async (tx) => {
    const revoked = await tx
      .update(privacyFieldGrants)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(privacyFieldGrants.patientId, patient.patientId),
          eq(privacyFieldGrants.professionalId, input.professionalId),
          isNull(privacyFieldGrants.revokedAt),
          field ? eq(privacyFieldGrants.field, field as PrivacyFieldKey) : undefined,
        ),
      )
      .returning({ field: privacyFieldGrants.field });
    if (revoked.length === 0) throw new NotFoundError("Liberação não encontrada ou já revogada.");

    const labels = revoked.map((row) => PRIVACY_FIELDS[row.field as PrivacyFieldKey]?.label ?? row.field);
    await postSystemMessage(tx, {
      patientId: patient.patientId,
      professionalId: input.professionalId,
      triggeredByUserId: patient.userId,
      text: `Liberação revogada pelo paciente: ${labels.join(", ")} ${labels.length === 1 ? "voltou" : "voltaram"} a seguir as preferências de privacidade dele.`,
    });
    await recordAudit(
      {
        actor,
        action: "PRIVACY_GRANT_REVOKED",
        subjectPatientId: patient.patientId,
        entityType: "privacy_field_grant",
        metadata: { professionalId: input.professionalId, fields: revoked.map((row) => row.field) },
      },
      tx,
    );
    return revoked.length;
  });
}

/** Pedidos de acesso aguardando a resposta do paciente (contador do menu). */
export async function countPendingAccessRequests(actor: Actor): Promise<number> {
  if (actor.role !== "PATIENT") return 0;
  const [row] = await db
    .select({ total: count() })
    .from(privacyAccessRequests)
    .where(and(eq(privacyAccessRequests.patientId, actor.patientId), eq(privacyAccessRequests.status, "PENDING")));
  return row?.total ?? 0;
}

export type PrivacySummary = {
  preset: PrivacyPresetKey;
  /** Como o paciente aparece para quem segue a configuração padrão. */
  displayName: string;
  overrides: number;
  /** Profissionais com dados liberados por pedido (ainda não revogados). */
  professionalsWithGrants: number;
  pendingRequests: number;
};

/** Resumo para o painel inicial do paciente. */
export async function getPrivacySummary(actor: Actor): Promise<PrivacySummary> {
  const patient = assertPatient(actor);
  const policies = await db
    .select({ professionalId: privacyPolicies.professionalId, fields: privacyPolicies.fields })
    .from(privacyPolicies)
    .where(eq(privacyPolicies.patientId, patient.patientId));
  const defaultFields = sanitizeFields(policies.find((policy) => policy.professionalId === null)?.fields ?? fieldsForPreset("ANONYMOUS"));

  const [person] = await db
    .select({ fullName: users.name, preferredName: patientProfiles.preferredName, pseudonym: patientProfiles.pseudonym })
    .from(patientProfiles)
    .innerJoin(users, eq(users.id, patientProfiles.userId))
    .where(eq(patientProfiles.id, patient.patientId))
    .limit(1);
  if (!person) throw new NotFoundError("Perfil não encontrado.");

  const grantHolders = await db
    .selectDistinct({ professionalId: privacyFieldGrants.professionalId })
    .from(privacyFieldGrants)
    .where(and(eq(privacyFieldGrants.patientId, patient.patientId), isNull(privacyFieldGrants.revokedAt)));

  return {
    preset: detectPreset(defaultFields),
    displayName: displayNameFor(person, defaultFields.name),
    overrides: policies.filter((policy) => policy.professionalId !== null).length,
    professionalsWithGrants: grantHolders.length,
    pendingRequests: await countPendingAccessRequests(actor),
  };
}

/** Política vigente de um paciente para um profissional (usada na tela de agendamento). */
export async function describePolicyForProfessional(
  patientId: string,
  professionalId: string,
): Promise<{ preset: PrivacyPresetKey; hasOverride: boolean }> {
  const policy = await resolvePolicy(patientId, professionalId);
  return { preset: detectPreset(policy.fields), hasOverride: Boolean(await findOverride(patientId, professionalId)) };
}
