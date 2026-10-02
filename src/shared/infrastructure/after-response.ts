import "server-only";
import { after } from "next/server";

/**
 * Agenda um trabalho para DEPOIS da resposta (ex.: enviar e-mail sem deixar a
 * pessoa esperando e sem revelar, pelo tempo de resposta, se um e-mail existe).
 *
 * Fora de uma requisição do Next.js (scripts e testes), executa na hora.
 * Falhas são registradas e nunca derrubam quem chamou.
 */
export async function afterResponse(task: () => Promise<unknown>): Promise<void> {
  const safeTask = async () => {
    try {
      await task();
    } catch (error) {
      console.error("[tarefa após a resposta] falhou", error);
    }
  };
  try {
    after(safeTask);
  } catch {
    await safeTask();
  }
}
