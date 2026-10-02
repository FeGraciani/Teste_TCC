import { describe, expect, it } from "vitest";
import { PRIVACY_FIELD_KEYS, PRIVACY_PRESETS, detectPreset, fieldsForPreset, revealFields, sanitizeFields } from "./privacy-fields";
import { ageOn, ageRangeLabel, displayNameFor, initialsOf, projectPatientForProfessional, type PatientPersonalData } from "./projection";
import { generatePseudonym, isValidPseudonym } from "./pseudonym";

const mariana: PatientPersonalData = {
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
  cpf: "12345678909",
  address: "Rua das Flores, 100, apto 42",
  emergencyContact: "Ana (irmã) — (11) 97777-6666",
  mainComplaint: "Crises de ansiedade antes de reuniões.",
  medications: "Sertralina 50 mg",
  allergies: "Dipirona",
  healthHistory: "Episódio depressivo em 2019.",
};

const TODAY = "2026-09-30";
const valueOf = (view: ReturnType<typeof projectPatientForProfessional>, key: string) => view.fields.find((field) => field.key === key)!.value;

describe("projeção de privacidade", () => {
  it("modo Identificado mostra todos os dados", () => {
    const view = projectPatientForProfessional(mariana, fieldsForPreset("IDENTIFIED"), TODAY);
    expect(view.displayName).toBe("Mariana Souza de Oliveira");
    expect(view.preset).toBe("IDENTIFIED");
    expect(view.hiddenCount).toBe(0);
    expect(valueOf(view, "cpf")).toEqual({ status: "shown", text: "123.456.789-09" });
    expect(valueOf(view, "birthDate")).toEqual({ status: "shown", text: "15/11/1993 (32 anos)" });
  });

  it("modo Discreto mostra primeiro nome (ou nome preferido), idade e cidade", () => {
    const view = projectPatientForProfessional(mariana, fieldsForPreset("DISCREET"), TODAY);
    expect(view.displayName).toBe("Mari");
    expect(valueOf(view, "birthDate")).toMatchObject({ status: "partial", text: "32 anos" });
    expect(valueOf(view, "location")).toMatchObject({ status: "partial", text: "São Paulo/SP" });
    expect(valueOf(view, "contact")).toEqual({ status: "hidden" });
    expect(valueOf(view, "cpf")).toEqual({ status: "hidden" });
  });

  it("modo Anônimo nunca expõe nome, contato, documento ou endereço", () => {
    const view = projectPatientForProfessional(mariana, fieldsForPreset("ANONYMOUS"), TODAY);
    expect(view.displayName).toBe("Jacarandá-27");
    expect(view.monogram).toBe("J");
    const serialized = JSON.stringify(view);
    for (const secret of ["Mariana", "Oliveira", "98888", "mariana@", "123.456", "Rua das Flores", "Arquiteta", "Ana (irmã)"]) {
      expect(serialized).not.toContain(secret);
    }
    expect(valueOf(view, "birthDate")).toMatchObject({ text: "Entre 25 e 34 anos" });
    // Informações de saúde essenciais continuam visíveis por padrão
    expect(valueOf(view, "medications")).toMatchObject({ status: "shown", text: "Sertralina 50 mg" });
  });

  it("campo oculto tem prioridade sobre campo vazio (não revela se o dado existe)", () => {
    const view = projectPatientForProfessional({ ...mariana, cpf: null }, fieldsForPreset("ANONYMOUS"), TODAY);
    expect(valueOf(view, "cpf")).toEqual({ status: "hidden" });
    const identified = projectPatientForProfessional({ ...mariana, cpf: null }, fieldsForPreset("IDENTIFIED"), TODAY);
    expect(valueOf(identified, "cpf")).toEqual({ status: "empty" });
  });

  it("configuração personalizada é detectada como CUSTOM", () => {
    const fields = { ...fieldsForPreset("ANONYMOUS"), name: "INITIALS" as const };
    const view = projectPatientForProfessional(mariana, fields, TODAY);
    expect(view.preset).toBe("CUSTOM");
    expect(view.displayName).toBe("M. S. O.");
  });
});

describe("regras de campos", () => {
  it("cada modo pronto define todos os campos com valores válidos", () => {
    for (const preset of Object.values(PRIVACY_PRESETS)) {
      expect(Object.keys(preset.fields).sort()).toEqual([...PRIVACY_FIELD_KEYS].sort());
      expect(sanitizeFields(preset.fields)).toEqual(preset.fields);
    }
  });

  it("sanitizeFields falha de forma segura: valores inválidos viram o nível mais reservado", () => {
    const fields = sanitizeFields({ name: "FULL", cpf: "TALVEZ", location: 42 });
    expect(fields.name).toBe("FULL");
    expect(fields.cpf).toBe("HIDDEN");
    expect(fields.location).toBe("HIDDEN");
    expect(fields.medications).toBe("HIDDEN");
  });

  it("detectPreset reconhece os modos prontos", () => {
    expect(detectPreset(fieldsForPreset("DISCREET"))).toBe("DISCREET");
  });

  it("revealFields libera somente os campos pedidos", () => {
    const fields = revealFields(fieldsForPreset("ANONYMOUS"), ["name", "location"]);
    expect(fields.name).toBe("FULL");
    expect(fields.location).toBe("FULL");
    expect(fields.cpf).toBe("HIDDEN");
  });
});

describe("utilitários", () => {
  it("calcula idade considerando o aniversário", () => {
    expect(ageOn("1993-11-15", "2026-11-14")).toBe(32);
    expect(ageOn("1993-11-15", "2026-11-15")).toBe(33);
  });

  it("faixas etárias", () => {
    expect(ageRangeLabel(18)).toBe("Entre 18 e 24 anos");
    expect(ageRangeLabel(34)).toBe("Entre 25 e 34 anos");
    expect(ageRangeLabel(70)).toBe("65 anos ou mais");
  });

  it("iniciais ignoram partículas", () => {
    expect(initialsOf("João da Silva dos Santos")).toBe("J. S. S.");
  });

  it("nome exibido por nível", () => {
    expect(displayNameFor({ ...mariana, preferredName: null }, "FIRST_NAME")).toBe("Mariana");
  });

  it("codinomes são válidos e variados", () => {
    const values = new Set(Array.from({ length: 50 }, () => generatePseudonym()));
    expect(values.size).toBeGreaterThan(30);
    for (const value of values) expect(isValidPseudonym(value)).toBe(true);
    expect(generatePseudonym(() => 0, 12)).toBe("Ipê-1000");
  });
});
