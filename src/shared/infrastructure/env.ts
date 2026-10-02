import { z } from "zod";

/**
 * Leitura validada das variáveis de ambiente.
 * Cada getter valida apenas o que precisa, para que ferramentas
 * (testes unitários, scripts) não exijam configuração completa.
 *
 * Sem "server-only" de propósito: o instrumentation.ts importa este arquivo
 * fora da árvore de Server Components. Os módulos que usam os segredos
 * (crypto.ts, client.ts) continuam protegidos por "server-only".
 */

const encryptionKeySchema = z
  .string({ error: "ENCRYPTION_KEY não definida. Gere uma com: npm run generate:key" })
  .refine((value) => Buffer.from(value, "base64").length === 32, {
    message: "ENCRYPTION_KEY deve ter exatamente 32 bytes em base64. Gere uma com: npm run generate:key",
  });

const databaseUrlSchema = z
  .string({ error: "DATABASE_URL não definida. Veja o arquivo .env.example" })
  .refine((value) => /^postgres(ql)?:\/\//.test(value), {
    message: "DATABASE_URL deve ser uma URL postgresql://",
  });

let cachedKey: Buffer | undefined;

export function encryptionKey(): Buffer {
  if (!cachedKey) {
    const parsed = encryptionKeySchema.parse(process.env.ENCRYPTION_KEY);
    cachedKey = Buffer.from(parsed, "base64");
  }
  return cachedKey;
}

export function databaseUrl(): string {
  return databaseUrlSchema.parse(process.env.DATABASE_URL);
}

export function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Valida tudo de uma vez — chamada na inicialização do servidor (instrumentation.ts). */
export function validateEnvironment(): void {
  const problems: string[] = [];
  for (const [name, check] of [
    ["DATABASE_URL", () => databaseUrl()],
    ["ENCRYPTION_KEY", () => encryptionKey()],
  ] as const) {
    try {
      check();
    } catch (error) {
      const message = error instanceof z.ZodError ? error.issues.map((i) => i.message).join("; ") : String(error);
      problems.push(`• ${name}: ${message}`);
    }
  }
  if (problems.length > 0) {
    throw new Error(`Configuração inválida do Alento:\n${problems.join("\n")}\nConsulte o README (seção "Configuração").`);
  }
  if (isProduction() && !process.env.SMTP_URL) {
    // Não impede o servidor de subir, mas convites e "esqueci minha senha" não chegam a ninguém.
    console.warn(
      "[Alento] SMTP_URL não configurado: convites de profissionais, links de nova senha e avisos de cancelamento NÃO serão enviados por e-mail.",
    );
  }
}
