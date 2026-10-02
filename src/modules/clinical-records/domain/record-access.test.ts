import { describe, expect, it } from "vitest";
import { canReadRecord, recordTypesFor } from "./record-access";

const psychiatrist = { professionalId: "psiq-1", specialty: "PSYCHIATRY" as const };
const otherPsychiatrist = { professionalId: "psiq-2", specialty: "PSYCHIATRY" as const };
const psychologist = { professionalId: "psi-1", specialty: "PSYCHOLOGY" as const };

describe("acesso ao prontuário", () => {
  it("o autor sempre lê o próprio registro", () => {
    const record = { authorId: "psiq-1", authorSpecialty: "PSYCHIATRY" as const, visibility: "AUTHOR_ONLY" as const };
    expect(canReadRecord(record, psychiatrist)).toBe(true);
  });

  it("registro da equipe é lido pelo próximo profissional, de qualquer especialidade", () => {
    const record = { authorId: "psiq-1", authorSpecialty: "PSYCHIATRY" as const, visibility: "CARE_TEAM" as const };
    expect(canReadRecord(record, otherPsychiatrist)).toBe(true);
    expect(canReadRecord(record, psychologist)).toBe(true);
  });

  it("registro restrito à especialidade só é lido por colegas da mesma área", () => {
    const record = { authorId: "psiq-1", authorSpecialty: "PSYCHIATRY" as const, visibility: "SAME_SPECIALTY" as const };
    expect(canReadRecord(record, otherPsychiatrist)).toBe(true);
    expect(canReadRecord(record, psychologist)).toBe(false);
  });

  it("anotação pessoal não é lida por mais ninguém", () => {
    const record = { authorId: "psi-1", authorSpecialty: "PSYCHOLOGY" as const, visibility: "AUTHOR_ONLY" as const };
    expect(canReadRecord(record, psychiatrist)).toBe(false);
  });

  it("conduta medicamentosa é exclusiva da psiquiatria", () => {
    expect(recordTypesFor("PSYCHIATRY")).toContain("PRESCRIPTION");
    expect(recordTypesFor("PSYCHOLOGY")).not.toContain("PRESCRIPTION");
  });
});
