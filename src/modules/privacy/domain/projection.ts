import {
  PRIVACY_FIELDS,
  PRIVACY_FIELD_KEYS,
  detectPreset,
  type NameLevel,
  type PrivacyFieldKey,
  type PrivacyFields,
  type PrivacyGroupKey,
  type PrivacyPresetKey,
} from "./privacy-fields";

/**
 * Projeção: transforma os dados completos do paciente naquilo que um
 * profissional pode ver, segundo a política de privacidade vigente.
 * É a única porta de saída dos dados pessoais do paciente para profissionais.
 */

export type PatientPersonalData = {
  fullName: string;
  preferredName: string | null;
  pseudonym: string;
  email: string;
  birthDate: string | null;
  gender: string | null;
  pronouns: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  occupation: string | null;
  maritalStatus: string | null;
  cpf: string | null;
  address: string | null;
  emergencyContact: string | null;
  mainComplaint: string | null;
  medications: string | null;
  allergies: string | null;
  healthHistory: string | null;
};

export type ProjectedValue =
  | { status: "shown"; text: string; detail?: string }
  | { status: "partial"; text: string; detail: string }
  | { status: "hidden" }
  | { status: "empty" };

export type ProjectedField = {
  key: PrivacyFieldKey;
  label: string;
  group: PrivacyGroupKey;
  value: ProjectedValue;
};

export type ProfessionalPatientView = {
  displayName: string;
  monogram: string;
  nameLevel: NameLevel;
  preset: PrivacyPresetKey;
  hiddenCount: number;
  fields: ProjectedField[];
};

const clean = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/** "Mariana Souza Oliveira" → "M. S. O." (ignora "de", "da", "dos"…) */
export function initialsOf(fullName: string): string {
  const particles = new Set(["de", "da", "do", "das", "dos", "e"]);
  return fullName
    .trim()
    .split(/\s+/)
    .filter((part) => !particles.has(part.toLowerCase()))
    .map((part) => `${part.charAt(0).toUpperCase()}.`)
    .join(" ");
}

/** Idade completa em anos numa data de referência (ambas AAAA-MM-DD). */
export function ageOn(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
}

export function ageRangeLabel(age: number): string {
  if (age < 18) return "Menos de 18 anos";
  if (age >= 65) return "65 anos ou mais";
  const bands: [number, number][] = [
    [18, 24],
    [25, 34],
    [35, 44],
    [45, 54],
    [55, 64],
  ];
  const band = bands.find(([min, max]) => age >= min && age <= max)!;
  return `Entre ${band[0]} e ${band[1]} anos`;
}

export function formatCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatBirthDate(birthDate: string): string {
  const [y, m, d] = birthDate.split("-");
  return `${d}/${m}/${y}`;
}

type NameSource = Pick<PatientPersonalData, "fullName" | "preferredName" | "pseudonym">;

/** Nome exibido para o profissional em listas (agenda, chat), conforme o nível escolhido. */
export function displayNameFor(source: NameSource, level: NameLevel): string {
  switch (level) {
    case "FULL":
      return source.fullName;
    case "FIRST_NAME":
      return clean(source.preferredName) ?? firstName(source.fullName);
    case "INITIALS":
      return initialsOf(source.fullName);
    case "PSEUDONYM":
      return source.pseudonym;
  }
}

export function monogramFor(source: NameSource, level: NameLevel): string {
  const name = displayNameFor(source, level);
  if (level === "INITIALS") return name.replace(/[.\s]/g, "").slice(0, 2);
  if (level === "PSEUDONYM") return name.charAt(0).toUpperCase();
  const parts = name.split(/\s+/);
  return (parts[0].charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : "")).toUpperCase();
}

function projectName(data: PatientPersonalData, level: NameLevel): ProjectedValue {
  const text = displayNameFor(data, level);
  switch (level) {
    case "FULL": {
      const preferred = clean(data.preferredName);
      return { status: "shown", text, detail: preferred ? `Prefere ser chamado(a) de ${preferred}` : undefined };
    }
    case "FIRST_NAME":
      return { status: "partial", text, detail: "Sobrenome oculto pelo paciente" };
    case "INITIALS":
      return { status: "partial", text, detail: "Só as iniciais do nome" };
    case "PSEUDONYM":
      return { status: "partial", text, detail: "Codinome escolhido pelo paciente" };
  }
}

function shownOrEmpty(value: string | null | undefined, detail?: string): ProjectedValue {
  const text = clean(value);
  return text ? { status: "shown", text, detail } : { status: "empty" };
}

function projectField(key: PrivacyFieldKey, data: PatientPersonalData, fields: PrivacyFields, today: string): ProjectedValue {
  const level = fields[key] as string;
  if (level === "HIDDEN") return { status: "hidden" };

  switch (key) {
    case "name":
      return projectName(data, fields.name);

    case "birthDate": {
      if (!data.birthDate) return { status: "empty" };
      const age = ageOn(data.birthDate, today);
      if (level === "FULL") return { status: "shown", text: `${formatBirthDate(data.birthDate)} (${age} anos)` };
      if (level === "AGE") return { status: "partial", text: `${age} anos`, detail: "Data de nascimento oculta" };
      return { status: "partial", text: ageRangeLabel(age), detail: "Idade exata oculta" };
    }

    case "genderPronouns": {
      const gender = clean(data.gender);
      const pronouns = clean(data.pronouns);
      if (!gender && !pronouns) return { status: "empty" };
      return { status: "shown", text: gender ?? pronouns!, detail: gender && pronouns ? `Pronomes: ${pronouns}` : undefined };
    }

    case "cpf":
      return data.cpf ? { status: "shown", text: formatCpf(data.cpf) } : { status: "empty" };

    case "contact": {
      const phone = clean(data.phone);
      const email = clean(data.email);
      if (!phone && !email) return { status: "empty" };
      return { status: "shown", text: phone ?? email!, detail: phone && email ? email : undefined };
    }

    case "location": {
      const cityState = [clean(data.city), clean(data.state)].filter(Boolean).join("/");
      if (level === "CITY") {
        return cityState ? { status: "partial", text: cityState, detail: "Endereço completo oculto" } : { status: "empty" };
      }
      const address = clean(data.address);
      if (!address && !cityState) return { status: "empty" };
      return { status: "shown", text: address ?? cityState, detail: address && cityState ? cityState : undefined };
    }

    case "emergencyContact":
      return shownOrEmpty(data.emergencyContact);
    case "occupation":
      return shownOrEmpty(data.occupation);
    case "maritalStatus":
      return shownOrEmpty(data.maritalStatus);
    case "mainComplaint":
      return shownOrEmpty(data.mainComplaint);
    case "medications":
      return shownOrEmpty(data.medications);
    case "allergies":
      return shownOrEmpty(data.allergies);
    case "healthHistory":
      return shownOrEmpty(data.healthHistory);
  }
}

/**
 * @param today data de hoje (AAAA-MM-DD) no fuso da clínica — usada para calcular a idade.
 */
export function projectPatientForProfessional(data: PatientPersonalData, fields: PrivacyFields, today: string): ProfessionalPatientView {
  const projected = PRIVACY_FIELD_KEYS.map((key) => ({
    key,
    label: PRIVACY_FIELDS[key].label,
    group: PRIVACY_FIELDS[key].group,
    value: projectField(key, data, fields, today),
  }));

  return {
    displayName: displayNameFor(data, fields.name),
    monogram: monogramFor(data, fields.name),
    nameLevel: fields.name,
    preset: detectPreset(fields),
    hiddenCount: projected.filter((field) => field.value.status === "hidden").length,
    fields: projected,
  };
}
