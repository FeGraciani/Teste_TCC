"use client";

import { Lock, RotateCcw, TriangleAlert } from "lucide-react";
import { useState, useTransition } from "react";
import { cn } from "@/shared/lib/cn";
import { INITIAL_ACTION_STATE, type ActionState } from "@/shared/lib/action-state";
import { Button } from "@/shared/ui/button";
import { Callout } from "@/shared/ui/callout";
import {
  NAMED_PRESET_KEYS,
  PRIVACY_FIELDS,
  PRIVACY_FIELD_GROUPS,
  PRIVACY_FIELD_KEYS,
  PRIVACY_PRESETS,
  detectPreset,
  fieldsForPreset,
  revealFields,
  type NamedPresetKey,
  type PrivacyFieldKey,
  type PrivacyFields,
} from "../../domain/privacy-fields";
import { projectPatientForProfessional, type PatientPersonalData } from "../../domain/projection";
import { removePrivacyOverrideAction, savePrivacySettingsAction } from "../actions";
import { PatientViewCard } from "./patient-view-card";

type Scope = {
  /** null = configuração padrão, válida para todos os profissionais sem exceção. */
  professionalId: string | null;
  professionalName: string | null;
  hasOverride: boolean;
  /** Dados liberados por pedido a este profissional (valem por cima do que for escolhido aqui). */
  grantedFields: PrivacyFieldKey[];
  /** Quantos profissionais têm liberações por pedido (aviso na configuração padrão). */
  professionalsWithGrants: number;
};

type Props = {
  scope: Scope;
  initialFields: PrivacyFields;
  personalData: PatientPersonalData;
  today: string;
};

/**
 * Editor do anonimato configurável: modos prontos, ajuste fino por campo e
 * prévia ao vivo do que o profissional vai ver (mesma função de projeção do servidor).
 */
export function PrivacyEditor({ scope, initialFields, personalData, today }: Props) {
  const [fields, setFields] = useState<PrivacyFields>(initialFields);
  const [result, setResult] = useState<ActionState>(INITIAL_ACTION_STATE);
  const [pending, startTransition] = useTransition();

  const preset = detectPreset(fields);
  const dirty = PRIVACY_FIELD_KEYS.some((key) => fields[key] !== initialFields[key]);
  // A prévia mostra o que o profissional vê DE FATO: as escolhas + as liberações por pedido.
  const view = projectPatientForProfessional(personalData, revealFields(fields, scope.grantedFields), today);
  const grantedLabels = scope.grantedFields.map((key) => PRIVACY_FIELDS[key].label);
  const audience = scope.professionalName ?? "os profissionais";

  const setLevel = (key: PrivacyFieldKey, level: string) => {
    setResult(INITIAL_ACTION_STATE);
    setFields((current) => ({ ...current, [key]: level }) as PrivacyFields);
  };

  const applyPreset = (key: NamedPresetKey) => {
    setResult(INITIAL_ACTION_STATE);
    setFields(fieldsForPreset(key));
  };

  const networkError: ActionState = {
    status: "error",
    message: "Não foi possível falar com o servidor. Confira sua conexão: suas escolhas continuam aqui, é só tentar salvar de novo.",
  };

  const save = () =>
    startTransition(async () => {
      try {
        setResult(await savePrivacySettingsAction({ professionalId: scope.professionalId, fields }));
      } catch {
        setResult({ ...networkError, at: Date.now() });
      }
    });

  const removeOverride = () =>
    startTransition(async () => {
      if (!scope.professionalId) return;
      try {
        setResult(await removePrivacyOverrideAction(scope.professionalId));
      } catch {
        setResult({ ...networkError, at: Date.now() });
      }
    });

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_25rem]">
      <div className="min-w-0 space-y-5">
        {scope.professionalId && !scope.hasOverride && (
          <Callout title={`${scope.professionalName} segue sua configuração padrão`}>
            Ao salvar aqui, você cria uma exceção que vale só para este profissional. Os demais continuam com a configuração padrão.
          </Callout>
        )}
        {scope.professionalId && grantedLabels.length > 0 && (
          <Callout title={`Por pedido aprovado, ${scope.professionalName} também vê: ${grantedLabels.join(", ")}`}>
            Essas liberações valem por cima das escolhas abaixo, e a prévia já mostra o resultado. Para tirar, revogue em “Dados liberados por
            pedido”, no topo da página.
          </Callout>
        )}
        {!scope.professionalId && scope.professionalsWithGrants > 0 && (
          <Callout title="Liberações por pedido continuam valendo">
            {scope.professionalsWithGrants === 1 ? "Um profissional tem" : `${scope.professionalsWithGrants} profissionais têm`} dados liberados por
            pedido. Mudar o padrão não desfaz essas liberações; para tirar, revogue em “Dados liberados por pedido”, no topo da página.
          </Callout>
        )}

        <section aria-labelledby="modos" className="rounded-[1.25rem] border border-linha bg-papel p-5 sm:p-6">
          <h2 id="modos" className="text-lg font-bold">
            Comece por um modo pronto
          </h2>
          <p className="mb-4 text-sm text-pedra">Depois, se quiser, ajuste cada dado abaixo.</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {NAMED_PRESET_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                aria-pressed={preset === key}
                className={cn(
                  "rounded-2xl border p-4 text-left transition-colors",
                  preset === key
                    ? "border-quaresmeira-600 bg-quaresmeira-50 ring-3 ring-quaresmeira-100"
                    : "border-linha-forte hover:border-quaresmeira-300",
                )}
              >
                <span className="block font-bold">{PRIVACY_PRESETS[key].label}</span>
                <span className="mt-1 block text-sm text-pedra">{PRIVACY_PRESETS[key].summary}</span>
              </button>
            ))}
          </div>
          {preset === "CUSTOM" && <p className="mt-3 text-sm font-semibold text-quaresmeira-700">Você está usando uma combinação personalizada.</p>}
        </section>

        {PRIVACY_FIELD_GROUPS.map((group) => (
          <section key={group.key} aria-labelledby={`grupo-${group.key}`} className="rounded-[1.25rem] border border-linha bg-papel p-5 sm:p-6">
            <h2 id={`grupo-${group.key}`} className="mb-1 text-lg font-bold">
              {group.label}
            </h2>
            <div className="divide-y divide-linha">
              {PRIVACY_FIELD_KEYS.filter((key) => PRIVACY_FIELDS[key].group === group.key).map((key) => (
                <FieldControl key={key} field={key} level={fields[key]} onChange={(level) => setLevel(key, level)} personalData={personalData} />
              ))}
            </div>
          </section>
        ))}

        <div
          className={cn(
            "rounded-2xl border border-linha bg-papel p-3 sm:p-4",
            dirty && "sticky bottom-3 z-10 bg-papel/95 shadow-flutuante backdrop-blur",
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-pedra" aria-live="polite">
              {dirty ? "Você tem alterações que ainda não foram salvas." : "Tudo salvo."}
            </p>
            <div className="flex flex-wrap gap-2">
              {dirty && (
                <Button variant="quiet" size="sm" onClick={() => setFields(initialFields)} disabled={pending}>
                  <RotateCcw className="size-4" aria-hidden />
                  Desfazer
                </Button>
              )}
              {scope.professionalId && scope.hasOverride && !dirty && (
                <Button variant="danger-quiet" size="sm" onClick={removeOverride} disabled={pending}>
                  Remover exceção
                </Button>
              )}
              <Button onClick={save} disabled={!dirty || pending} size="sm">
                {pending ? "Salvando…" : scope.professionalId ? "Salvar para este profissional" : "Salvar preferências"}
              </Button>
            </div>
          </div>
          {result.status !== "idle" && result.message && (
            <p className={cn("mt-2 text-sm font-semibold", result.status === "success" ? "text-folha-700" : "text-urucum-700")} role="status">
              {result.message}
            </p>
          )}
        </div>
      </div>

      <aside className="h-fit space-y-3 xl:sticky xl:top-6" aria-label="Prévia">
        <h2 className="text-lg font-bold">
          Prévia: o que {audience} {scope.professionalName ? "vê" : "veem"}
        </h2>
        <PatientViewCard view={view} subtitle="Atualiza enquanto você ajusta" animated />
        <p className="flex gap-2 text-sm text-pedra">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          Dados ocultos não são enviados ao profissional. A névoa é só um desenho: por trás dela não existe o dado real.
        </p>
      </aside>
    </div>
  );
}

function FieldControl({
  field,
  level,
  onChange,
  personalData,
}: {
  field: PrivacyFieldKey;
  level: string;
  onChange: (level: string) => void;
  personalData: PatientPersonalData;
}) {
  const definition = PRIVACY_FIELDS[field];
  const name = `campo-${field}`;
  const safetyNote = "safetyNote" in definition ? definition.safetyNote : null;

  let hint: string | null = null;
  if (field === "name") {
    hint = personalData.preferredName
      ? `Com “Primeiro nome”, aparece o nome que você prefere: ${personalData.preferredName}. Seu codinome é ${personalData.pseudonym}.`
      : `Seu codinome é ${personalData.pseudonym}.`;
  }

  return (
    <fieldset className="grid gap-3 py-4 md:grid-cols-[minmax(0,14rem)_1fr]">
      <legend className="sr-only">{definition.label}</legend>
      <div aria-hidden>
        <p className="font-semibold">{definition.label}</p>
        <p className="text-sm text-pedra">{definition.description}</p>
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {definition.options.map((option) => {
            const selected = option.value === level;
            const hidden = option.value === "HIDDEN";
            return (
              <label
                key={option.value}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-quaresmeira-500",
                  selected && hidden && "border-tinta bg-tinta text-white",
                  selected && !hidden && "border-quaresmeira-700 bg-quaresmeira-700 text-white",
                  !selected && "border-linha-forte bg-papel text-tinta hover:border-quaresmeira-300",
                )}
              >
                <input type="radio" name={name} value={option.value} checked={selected} onChange={() => onChange(option.value)} className="sr-only" />
                {hidden && <Lock className="size-3.5" aria-hidden />}
                {option.label}
              </label>
            );
          })}
        </div>
        {hint && <p className="text-sm text-pedra">{hint}</p>}
        {safetyNote && level === "HIDDEN" && (
          <p className="flex gap-2 rounded-xl bg-ipe-50 px-3 py-2 text-sm text-ipe-800 ring-1 ring-inset ring-ipe-300">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {safetyNote}
          </p>
        )}
      </div>
    </fieldset>
  );
}
