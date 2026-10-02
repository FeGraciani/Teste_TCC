/**
 * Executado uma vez quando o servidor do Next.js inicia.
 * Falha cedo, com mensagem clara em português, se a configuração estiver
 * incompleta — melhor do que descobrir no primeiro login de um paciente.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Durante o "next build" o banco e a chave podem não estar disponíveis.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { validateEnvironment } = await import("./shared/infrastructure/env");
  validateEnvironment();
}
