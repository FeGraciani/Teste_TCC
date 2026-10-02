import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

config({ quiet: true });

/**
 * Aplica as migrações SQL de /drizzle no banco de DATABASE_URL.
 * Seguro para rodar várias vezes (só aplica o que falta).
 * Uso: npm run db:migrate
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definida. Copie .env.example para .env.");

  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    console.log("→ Aplicando migrações…");
    await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
    console.log("✓ Banco atualizado.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("✗ Falha ao migrar:", error);
  process.exit(1);
});
