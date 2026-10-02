import type { z } from "zod";
import { ValidationError } from "@/shared/errors";

/** Converte erros do Zod em { campo: [mensagens] } para exibir nos formulários. */
export function zodFieldErrors(error: { issues: { path: PropertyKey[]; message: string }[] }): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (result[key] ??= []).push(issue.message);
  }
  return result;
}

/** Valida ou lança ValidationError com as mensagens por campo. */
export function parseOrThrow<S extends z.ZodType>(schema: S, input: unknown, message = "Revise os campos destacados."): z.infer<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new ValidationError(message, zodFieldErrors(parsed.error));
  return parsed.data;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Identificadores vindos da URL ou de formulários: evita consultar o banco com lixo. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** Lê um FormData como objeto simples (último valor de cada chave). */
export function formDataToObject(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) result[key] = value;
  }
  return result;
}
