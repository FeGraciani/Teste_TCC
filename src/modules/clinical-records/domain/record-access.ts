export type Specialty = "PSYCHOLOGY" | "PSYCHIATRY";
export type RecordType = "ANAMNESIS" | "EVOLUTION" | "HANDOFF" | "PRESCRIPTION" | "REFERRAL" | "NOTE";
export type RecordVisibility = "CARE_TEAM" | "SAME_SPECIALTY" | "AUTHOR_ONLY";

export const SPECIALTY_LABELS: Record<Specialty, string> = {
  PSYCHOLOGY: "Psicologia",
  PSYCHIATRY: "Psiquiatria",
};

export const RECORD_TYPES: Record<RecordType, { label: string; hint: string; specialties: Specialty[] }> = {
  HANDOFF: {
    label: "Nota para o próximo profissional",
    hint: "Resumo do caso para quem continuar o cuidado. Aparece fixada no topo do prontuário.",
    specialties: ["PSYCHOLOGY", "PSYCHIATRY"],
  },
  ANAMNESIS: {
    label: "Anamnese",
    hint: "Histórico e avaliação inicial.",
    specialties: ["PSYCHOLOGY", "PSYCHIATRY"],
  },
  EVOLUTION: {
    label: "Evolução",
    hint: "Registro de uma sessão ou consulta.",
    specialties: ["PSYCHOLOGY", "PSYCHIATRY"],
  },
  PRESCRIPTION: {
    label: "Conduta medicamentosa",
    hint: "Medicamentos prescritos, ajustes de dose e orientações.",
    specialties: ["PSYCHIATRY"],
  },
  REFERRAL: {
    label: "Encaminhamento",
    hint: "Indicação para outro profissional ou serviço.",
    specialties: ["PSYCHOLOGY", "PSYCHIATRY"],
  },
  NOTE: {
    label: "Observação",
    hint: "Qualquer outra informação relevante.",
    specialties: ["PSYCHOLOGY", "PSYCHIATRY"],
  },
};

export const VISIBILITY_OPTIONS: Record<RecordVisibility, { label: string; hint: string }> = {
  CARE_TEAM: {
    label: "Equipe que cuida do paciente",
    hint: "Qualquer profissional da clínica com consulta marcada ou realizada com este paciente.",
  },
  SAME_SPECIALTY: {
    label: "Só profissionais da minha especialidade",
    hint: "Útil para registros técnicos de psicoterapia ou de conduta psiquiátrica.",
  },
  AUTHOR_ONLY: {
    label: "Só eu",
    hint: "Anotação pessoal. Nenhum outro profissional vê.",
  },
};

export function recordTypesFor(specialty: Specialty): RecordType[] {
  return (Object.keys(RECORD_TYPES) as RecordType[]).filter((type) => RECORD_TYPES[type].specialties.includes(specialty));
}

type RecordAccessInfo = {
  authorId: string;
  authorSpecialty: Specialty;
  visibility: RecordVisibility;
};

type Viewer = {
  professionalId: string;
  specialty: Specialty;
};

/**
 * Quem lê cada registro do prontuário.
 * Pré-condição (verificada na camada de aplicação): o leitor é um
 * PROFISSIONAL com vínculo de cuidado com o paciente. Pacientes e
 * administradores nunca chegam aqui.
 */
export function canReadRecord(record: RecordAccessInfo, viewer: Viewer): boolean {
  if (record.authorId === viewer.professionalId) return true;
  switch (record.visibility) {
    case "CARE_TEAM":
      return true;
    case "SAME_SPECIALTY":
      return record.authorSpecialty === viewer.specialty;
    case "AUTHOR_ONLY":
      return false;
  }
}

export const RECORD_MIN_LENGTH = 10;
export const RECORD_MAX_LENGTH = 10_000;
