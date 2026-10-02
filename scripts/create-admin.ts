/**
 * Cria uma conta da administração. Use para o PRIMEIRO acesso em produção
 * (depois, novas contas podem ser criadas pela própria área administrativa).
 *
 * Uso:
 *   npm run admin:create -- --nome "Renata Campos" --email renata@clinica.com.br
 * A senha é pedida no terminal (ou informe ADMIN_PASSWORD no ambiente).
 */
import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { eq } from "drizzle-orm";
import { recordAudit } from "../src/modules/audit/application/audit-service";
import { hashPassword, passwordProblem } from "../src/modules/identity/domain/password";
import { db, pool } from "../src/shared/infrastructure/database/client";
import { users } from "../src/shared/infrastructure/database/schema";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const prompt = createInterface({ input, output });
  try {
    const name = argument("nome") ?? (await prompt.question("Nome completo: ")).trim();
    const email = (argument("email") ?? (await prompt.question("E-mail: "))).trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD ?? (await prompt.question("Senha (8+ caracteres, letras e números): "));

    if (name.split(/\s+/).length < 2) throw new Error("Informe nome e sobrenome.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail inválido.");
    const problem = passwordProblem(password);
    if (problem) throw new Error(problem);

    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) throw new Error("Já existe uma conta com este e-mail.");

    const [created] = await db
      .insert(users)
      .values({ name, email, role: "ADMIN", passwordHash: await hashPassword(password), passwordSetAt: new Date() })
      .returning({ id: users.id });
    await recordAudit({ action: "ADMIN_CREATED", entityType: "user", entityId: created!.id, metadata: { via: "linha de comando" } });
    console.log(`\n✓ Conta da administração criada para ${email}. Entre em /entrar?perfil=administracao`);
  } finally {
    prompt.close();
  }
}

main()
  .catch((error: unknown) => {
    console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
