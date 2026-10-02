import "server-only";
import { unstable_rethrow } from "next/navigation";
import { isDomainError, ValidationError } from "@/shared/errors";
import type { ActionState } from "@/shared/lib/action-state";

/** Campos que nunca voltam para o navegador, nem em caso de erro. */
const NEVER_ECHO = /password|senha|token/i;

function echoValues(formData?: FormData): Record<string, string> | undefined {
  if (!formData) return undefined;
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION") && !NEVER_ECHO.test(key)) values[key] = value;
  }
  return values;
}

/**
 * Executa o corpo de uma Server Action e converte erros de negócio em
 * mensagens para o formulário. redirect()/notFound() continuam funcionando.
 *
 * @param formData quando informado, os valores enviados voltam em caso de erro
 *                 para o formulário não ser apagado.
 */
export async function runAction(body: () => Promise<string | void>, formData?: FormData): Promise<ActionState> {
  try {
    const message = await body();
    return { status: "success", message: message ?? "Pronto!", at: Date.now() };
  } catch (error) {
    unstable_rethrow(error);
    if (isDomainError(error)) {
      return {
        status: "error",
        message: error.message,
        fieldErrors: error instanceof ValidationError ? error.fieldErrors : undefined,
        values: echoValues(formData),
        at: Date.now(),
      };
    }
    console.error("[action] erro inesperado", error);
    return {
      status: "error",
      message: "Algo deu errado do nosso lado. Tente de novo em instantes.",
      values: echoValues(formData),
      at: Date.now(),
    };
  }
}
