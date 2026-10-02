"use client";

import { useId, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { DEFAULT_PRESET, NAMED_PRESET_KEYS, PRIVACY_PRESETS, fieldsForPreset, type NamedPresetKey } from "../../domain/privacy-fields";
import { projectPatientForProfessional, type PatientPersonalData } from "../../domain/projection";
import { PatientViewCard } from "./patient-view-card";

/** Pessoa fictícia usada na demonstração do site. */
const DEMO_PERSON: PatientPersonalData = {
  fullName: "Mariana Souza de Oliveira",
  preferredName: "Mari",
  pseudonym: "Jacarandá-27",
  email: "mariana@exemplo.com",
  birthDate: "1993-11-15",
  gender: "Mulher",
  pronouns: "ela/dela",
  phone: "(11) 98888-7777",
  city: "São Paulo",
  state: "SP",
  occupation: "Arquiteta",
  maritalStatus: "Solteira",
  cpf: null,
  address: "Rua das Flores, 100, apto. 42",
  emergencyContact: "Ana (irmã), (11) 97777-6666",
  mainComplaint: "Crises de ansiedade antes de reuniões no trabalho.",
  medications: "Sertralina 50 mg pela manhã",
  allergies: "Dipirona",
  healthHistory: null,
};

const DEMO_KEYS = ["name", "birthDate", "contact", "location", "occupation", "mainComplaint", "medications"] as const;

/**
 * Demonstração interativa do diferencial da clínica: a mesma pessoa vista
 * pelo profissional em cada modo de privacidade. Usa a mesma função de
 * projeção do servidor, então o exemplo é fiel ao comportamento real.
 */
export function PrivacyDemo({ today }: { today: string }) {
  const [preset, setPreset] = useState<NamedPresetKey>(DEFAULT_PRESET);
  const name = useId();
  const view = projectPatientForProfessional(DEMO_PERSON, fieldsForPreset(preset), today);

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-pedra">Experimente: como você quer aparecer?</legend>
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-nevoa-escura p-1">
          {NAMED_PRESET_KEYS.map((key) => (
            <label
              key={key}
              className={cn(
                "cursor-pointer rounded-xl px-2 py-2.5 text-center text-sm font-semibold transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-quaresmeira-500 sm:text-[0.95rem]",
                preset === key ? "bg-papel text-quaresmeira-800 shadow-suave" : "text-pedra hover:text-tinta",
              )}
            >
              <input type="radio" name={name} value={key} checked={preset === key} onChange={() => setPreset(key)} className="sr-only" />
              {PRIVACY_PRESETS[key].label}
            </label>
          ))}
        </div>
      </fieldset>

      <PatientViewCard view={view} onlyKeys={DEMO_KEYS} subtitle="Como a sua psiquiatra vê você" animated />

      <p className="text-sm text-pedra" aria-live="polite">
        {PRIVACY_PRESETS[preset].summary} Dados fictícios, só para demonstração.
      </p>
    </div>
  );
}
