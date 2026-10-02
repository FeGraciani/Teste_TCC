/**
 * Catálogo dos dados que o paciente controla, com os níveis de exibição
 * permitidos para cada um. A PRIMEIRA opção de cada campo é sempre a mais
 * reveladora; a ÚLTIMA é a mais reservada.
 *
 * Este arquivo é puro (sem banco, sem Node): roda no servidor e no navegador,
 * o que permite a pré-visualização ao vivo na tela de privacidade.
 */

export const PRIVACY_FIELD_GROUPS = [
  { key: "identity", label: "Identificação" },
  { key: "contact", label: "Contato e endereço" },
  { key: "life", label: "Sobre você" },
  { key: "clinical", label: "Informações de saúde" },
] as const;

export type PrivacyGroupKey = (typeof PRIVACY_FIELD_GROUPS)[number]["key"];

type FieldDefinition = {
  label: string;
  group: PrivacyGroupKey;
  description: string;
  options: readonly { value: string; label: string }[];
  /** Aviso exibido quando o paciente oculta um dado importante para a segurança do tratamento. */
  safetyNote?: string;
};

const SHOW_HIDE = [
  { value: "SHOW", label: "Visível" },
  { value: "HIDDEN", label: "Oculto" },
] as const;

export const PRIVACY_FIELDS = {
  name: {
    label: "Nome",
    group: "identity",
    description: "Como você aparece na agenda, no chat e nas anotações do profissional.",
    options: [
      { value: "FULL", label: "Nome completo" },
      { value: "FIRST_NAME", label: "Primeiro nome" },
      { value: "INITIALS", label: "Iniciais" },
      { value: "PSEUDONYM", label: "Codinome" },
    ],
  },
  birthDate: {
    label: "Data de nascimento",
    group: "identity",
    description: "A idade ajuda o profissional a contextualizar o cuidado.",
    options: [
      { value: "FULL", label: "Data completa" },
      { value: "AGE", label: "Só a idade" },
      { value: "AGE_RANGE", label: "Faixa etária" },
      { value: "HIDDEN", label: "Oculto" },
    ],
  },
  genderPronouns: {
    label: "Gênero e pronomes",
    group: "identity",
    description: "Para que o profissional se dirija a você do jeito certo.",
    options: SHOW_HIDE,
  },
  cpf: {
    label: "CPF",
    group: "identity",
    description: "Só é necessário para alguns documentos, como receitas de controle especial.",
    options: SHOW_HIDE,
  },
  contact: {
    label: "Telefone e e-mail",
    group: "contact",
    description: "Os avisos sobre consultas chegam pelo chat do app, então o profissional não precisa do seu contato.",
    options: SHOW_HIDE,
  },
  location: {
    label: "Endereço",
    group: "contact",
    description: "Você pode mostrar só a cidade.",
    options: [
      { value: "FULL", label: "Endereço completo" },
      { value: "CITY", label: "Só cidade e estado" },
      { value: "HIDDEN", label: "Oculto" },
    ],
  },
  emergencyContact: {
    label: "Contato de emergência",
    group: "contact",
    description: "Alguém que o profissional pode acionar se você estiver em risco.",
    options: SHOW_HIDE,
  },
  occupation: {
    label: "Profissão",
    group: "life",
    description: "Ajuda a entender sua rotina.",
    options: SHOW_HIDE,
  },
  maritalStatus: {
    label: "Estado civil",
    group: "life",
    description: "Contexto sobre sua vida familiar.",
    options: SHOW_HIDE,
  },
  mainComplaint: {
    label: "O que trouxe você até aqui",
    group: "clinical",
    description: "O que você escreveu sobre o motivo da busca por atendimento.",
    options: SHOW_HIDE,
  },
  medications: {
    label: "Medicações em uso",
    group: "clinical",
    description: "Remédios que você toma atualmente.",
    options: SHOW_HIDE,
    safetyNote: "Recomendamos deixar visível para psiquiatras: assim evitamos interações perigosas entre remédios.",
  },
  allergies: {
    label: "Alergias",
    group: "clinical",
    description: "Alergias a medicamentos ou outras substâncias.",
    options: SHOW_HIDE,
    safetyNote: "Recomendamos deixar visível: alergias pesam na escolha de qualquer medicamento.",
  },
  healthHistory: {
    label: "Histórico de saúde",
    group: "clinical",
    description: "Diagnósticos, tratamentos e internações anteriores.",
    options: SHOW_HIDE,
  },
} as const satisfies Record<string, FieldDefinition>;

export type PrivacyFieldKey = keyof typeof PRIVACY_FIELDS;
export type PrivacyLevelOf<K extends PrivacyFieldKey> = (typeof PRIVACY_FIELDS)[K]["options"][number]["value"];
export type PrivacyFields = { [K in PrivacyFieldKey]: PrivacyLevelOf<K> };
export type NameLevel = PrivacyLevelOf<"name">;

export const PRIVACY_FIELD_KEYS = Object.keys(PRIVACY_FIELDS) as PrivacyFieldKey[];

export const PRIVACY_PRESETS = {
  IDENTIFIED: {
    label: "Identificado",
    summary: "O profissional vê seus dados completos, como numa clínica tradicional.",
    fields: {
      name: "FULL",
      birthDate: "FULL",
      genderPronouns: "SHOW",
      cpf: "SHOW",
      contact: "SHOW",
      location: "FULL",
      emergencyContact: "SHOW",
      occupation: "SHOW",
      maritalStatus: "SHOW",
      mainComplaint: "SHOW",
      medications: "SHOW",
      allergies: "SHOW",
      healthHistory: "SHOW",
    },
  },
  DISCREET: {
    label: "Discreto",
    summary: "Primeiro nome, idade e cidade. Documentos, contato e endereço ficam ocultos.",
    fields: {
      name: "FIRST_NAME",
      birthDate: "AGE",
      genderPronouns: "SHOW",
      cpf: "HIDDEN",
      contact: "HIDDEN",
      location: "CITY",
      emergencyContact: "HIDDEN",
      occupation: "SHOW",
      maritalStatus: "SHOW",
      mainComplaint: "SHOW",
      medications: "SHOW",
      allergies: "SHOW",
      healthHistory: "SHOW",
    },
  },
  ANONYMOUS: {
    label: "Anônimo",
    summary: "Você aparece com um codinome. Só as informações de saúde que você escolher são compartilhadas.",
    fields: {
      name: "PSEUDONYM",
      birthDate: "AGE_RANGE",
      genderPronouns: "HIDDEN",
      cpf: "HIDDEN",
      contact: "HIDDEN",
      location: "HIDDEN",
      emergencyContact: "HIDDEN",
      occupation: "HIDDEN",
      maritalStatus: "HIDDEN",
      mainComplaint: "SHOW",
      medications: "SHOW",
      allergies: "SHOW",
      healthHistory: "HIDDEN",
    },
  },
} as const satisfies Record<string, { label: string; summary: string; fields: PrivacyFields }>;

export type NamedPresetKey = keyof typeof PRIVACY_PRESETS;
export type PrivacyPresetKey = NamedPresetKey | "CUSTOM";

export const NAMED_PRESET_KEYS = Object.keys(PRIVACY_PRESETS) as NamedPresetKey[];

export const DEFAULT_PRESET: NamedPresetKey = "DISCREET";

export function presetLabel(preset: PrivacyPresetKey): string {
  return preset === "CUSTOM" ? "Personalizado" : PRIVACY_PRESETS[preset].label;
}

export function fieldsForPreset(preset: NamedPresetKey): PrivacyFields {
  return { ...PRIVACY_PRESETS[preset].fields };
}

export function isValidLevel(field: PrivacyFieldKey, level: unknown): boolean {
  return PRIVACY_FIELDS[field].options.some((option) => option.value === level);
}

/** Descobre se um conjunto de campos corresponde exatamente a um modo pronto. */
export function detectPreset(fields: PrivacyFields): PrivacyPresetKey {
  for (const key of NAMED_PRESET_KEYS) {
    const preset = PRIVACY_PRESETS[key].fields as PrivacyFields;
    if (PRIVACY_FIELD_KEYS.every((field) => preset[field] === fields[field])) return key;
  }
  return "CUSTOM";
}

/**
 * Normaliza um JSON vindo do banco ou de um formulário: qualquer campo
 * ausente ou inválido assume o valor MAIS RESERVADO (falha segura).
 */
export function sanitizeFields(input: unknown): PrivacyFields {
  const source = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const result = {} as Record<PrivacyFieldKey, string>;
  for (const field of PRIVACY_FIELD_KEYS) {
    const options = PRIVACY_FIELDS[field].options;
    const candidate = source[field];
    result[field] = isValidLevel(field, candidate) ? (candidate as string) : options[options.length - 1].value;
  }
  return result as PrivacyFields;
}

export function mostRevealingLevel<K extends PrivacyFieldKey>(field: K): PrivacyLevelOf<K> {
  return PRIVACY_FIELDS[field].options[0].value as PrivacyLevelOf<K>;
}

export function isFullyRevealed(fields: PrivacyFields, field: PrivacyFieldKey): boolean {
  return fields[field] === mostRevealingLevel(field);
}

/** Libera campos específicos (usado quando o paciente aprova um pedido de acesso). */
export function revealFields(fields: PrivacyFields, toReveal: readonly PrivacyFieldKey[]): PrivacyFields {
  const next = { ...fields } as Record<PrivacyFieldKey, string>;
  for (const field of toReveal) next[field] = mostRevealingLevel(field);
  return next as PrivacyFields;
}

export function levelLabel(field: PrivacyFieldKey, level: string): string {
  return PRIVACY_FIELDS[field].options.find((option) => option.value === level)?.label ?? level;
}
