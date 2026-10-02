import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, type Executor } from "@/shared/infrastructure/database/client";
import { privacyFieldGrants, privacyPolicies } from "../infrastructure/schema";
import {
  PRIVACY_FIELD_KEYS,
  detectPreset,
  fieldsForPreset,
  revealFields,
  sanitizeFields,
  type NamedPresetKey,
  type PrivacyFieldKey,
  type PrivacyFields,
} from "../domain/privacy-fields";

/**
 * Persistência das políticas de privacidade (sem regras de autorização —
 * quem chama é responsável por isso). Usado pelo cadastro e pelo serviço
 * de privacidade.
 */

export async function createDefaultPolicy(executor: Executor, patientId: string, preset: NamedPresetKey): Promise<void> {
  await executor.insert(privacyPolicies).values({ patientId, professionalId: null, preset, fields: fieldsForPreset(preset) });
}

export async function findDefaultPolicy(patientId: string, executor: Executor = db) {
  const [row] = await executor
    .select()
    .from(privacyPolicies)
    .where(and(eq(privacyPolicies.patientId, patientId), isNull(privacyPolicies.professionalId)))
    .limit(1);
  return row ?? null;
}

export async function findOverride(patientId: string, professionalId: string, executor: Executor = db) {
  const [row] = await executor
    .select()
    .from(privacyPolicies)
    .where(and(eq(privacyPolicies.patientId, patientId), eq(privacyPolicies.professionalId, professionalId)))
    .limit(1);
  return row ?? null;
}

export type ResolvedPolicy = {
  /** O que o profissional vê de fato: configuração (exceção ou padrão) + liberações por pedido. */
  fields: PrivacyFields;
  source: "override" | "default";
  /** Dados liberados por pedido aprovado (valem por cima da configuração, até o paciente revogar). */
  grantedFields: PrivacyFieldKey[];
};

const isFieldKey = (value: string): value is PrivacyFieldKey => (PRIVACY_FIELD_KEYS as string[]).includes(value);

/** Liberações ativas (pedidos aprovados e não revogados) de um paciente para um profissional. */
export async function findActiveGrants(patientId: string, professionalId: string, executor: Executor = db): Promise<PrivacyFieldKey[]> {
  const rows = await executor
    .select({ field: privacyFieldGrants.field })
    .from(privacyFieldGrants)
    .where(
      and(eq(privacyFieldGrants.patientId, patientId), eq(privacyFieldGrants.professionalId, professionalId), isNull(privacyFieldGrants.revokedAt)),
    );
  return rows.map((row) => row.field).filter(isFieldKey);
}

/** Liberações ativas de vários pacientes para um profissional (listas: agenda, chat, pacientes). */
export async function findActiveGrantsForPatients(
  patientIds: readonly string[],
  professionalId: string,
  executor: Executor = db,
): Promise<Map<string, PrivacyFieldKey[]>> {
  const result = new Map<string, PrivacyFieldKey[]>();
  if (patientIds.length === 0) return result;
  const rows = await executor
    .select({ patientId: privacyFieldGrants.patientId, field: privacyFieldGrants.field })
    .from(privacyFieldGrants)
    .where(
      and(
        inArray(privacyFieldGrants.patientId, [...patientIds]),
        eq(privacyFieldGrants.professionalId, professionalId),
        isNull(privacyFieldGrants.revokedAt),
      ),
    );
  for (const row of rows) {
    if (!isFieldKey(row.field)) continue;
    result.set(row.patientId, [...(result.get(row.patientId) ?? []), row.field]);
  }
  return result;
}

/**
 * A política que vale para um profissional: a exceção dele, se existir;
 * senão, a padrão — e, por cima, os dados que o paciente liberou para ele
 * em pedidos aprovados. Sem nenhuma política, vale o modo mais reservado (falha segura).
 */
export async function resolvePolicy(patientId: string, professionalId: string, executor: Executor = db): Promise<ResolvedPolicy> {
  const grantedFields = await findActiveGrants(patientId, professionalId, executor);
  const override = await findOverride(patientId, professionalId, executor);
  if (override) return { fields: revealFields(sanitizeFields(override.fields), grantedFields), source: "override", grantedFields };
  const fallback = await findDefaultPolicy(patientId, executor);
  return {
    fields: revealFields(sanitizeFields(fallback?.fields ?? fieldsForPreset("ANONYMOUS")), grantedFields),
    source: "default",
    grantedFields,
  };
}

/** Grava (insere ou atualiza) a política padrão ou a exceção de um profissional. */
export async function upsertPolicy(executor: Executor, patientId: string, professionalId: string | null, fields: PrivacyFields): Promise<void> {
  const preset = detectPreset(fields);
  const existing = professionalId ? await findOverride(patientId, professionalId, executor) : await findDefaultPolicy(patientId, executor);
  if (existing) {
    await executor.update(privacyPolicies).set({ fields, preset, updatedAt: new Date() }).where(eq(privacyPolicies.id, existing.id));
  } else {
    await executor.insert(privacyPolicies).values({ patientId, professionalId, fields, preset });
  }
}
