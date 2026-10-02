import { z } from "zod";
import { MINIMUM_PATIENT_AGE } from "@/config/clinic";

export const BRAZILIAN_STATES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

/** Campos guardados criptografados (JSON) em patient_profiles.sensitive_data. */
export const SENSITIVE_KEYS = ["cpf", "address", "emergencyContact", "mainComplaint", "medications", "allergies", "healthHistory"] as const;

export type SensitiveKey = (typeof SENSITIVE_KEYS)[number];
export type SensitiveData = Partial<Record<SensitiveKey, string | null>>;

/** Validação oficial de CPF (dígitos verificadores). */
export function isValidCpf(value: string): boolean {
  const cpf = value.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

/** Idade em anos completos numa data de referência (AAAA-MM-DD). */
export function ageFromBirthDate(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .transform((value) => value ?? null);

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.")
  .refine((value) => !Number.isNaN(new Date(`${value}T12:00:00Z`).getTime()), "Informe uma data válida.");

export function birthDateSchema(today: string) {
  return isoDate
    .refine(
      (value) => ageFromBirthDate(value, today) >= MINIMUM_PATIENT_AGE,
      `O atendimento pelo app é para maiores de ${MINIMUM_PATIENT_AGE} anos. Para menores, fale com a clínica.`,
    )
    .refine((value) => ageFromBirthDate(value, today) <= 120, "Confira o ano de nascimento.");
}

export const fullNameSchema = z
  .string()
  .trim()
  .min(3, "Informe seu nome completo.")
  .max(120, "Use no máximo 120 caracteres.")
  .refine((value) => value.split(/\s+/).length >= 2, "Informe nome e sobrenome.");

export function patientProfileSchema(today: string) {
  return z.object({
    name: fullNameSchema,
    preferredName: optionalText(60),
    birthDate: birthDateSchema(today),
    gender: optionalText(60),
    pronouns: optionalText(40),
    phone: optionalText(20).refine((value) => value === null || /^\d{10,11}$/.test(value.replace(/\D/g, "")), "Informe um telefone com DDD."),
    city: optionalText(80),
    state: optionalText(2).refine(
      (value) => value === null || (BRAZILIAN_STATES as readonly string[]).includes(value.toUpperCase()),
      "Escolha um estado.",
    ),
    occupation: optionalText(80),
    maritalStatus: optionalText(40),
    cpf: optionalText(14).refine((value) => value === null || isValidCpf(value), "CPF inválido."),
    address: optionalText(200),
    emergencyContact: optionalText(200),
    mainComplaint: optionalText(2000),
    medications: optionalText(2000),
    allergies: optionalText(1000),
    healthHistory: optionalText(2000),
  });
}

export type PatientProfileInput = z.infer<ReturnType<typeof patientProfileSchema>>;

export function formatPhone(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return value;
}
