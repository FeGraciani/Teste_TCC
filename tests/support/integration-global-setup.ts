import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

/**
 * Executado uma vez antes dos testes de integração: recria o banco de
 * TESTE do zero e aplica todas as migrações (as mesmas de produção).
 */
export default async function setup() {
  config({ quiet: true });
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("Defina TEST_DATABASE_URL no .env: um banco exclusivo para testes (ele é apagado a cada execução).");
  if (url === process.env.DATABASE_URL) throw new Error("TEST_DATABASE_URL precisa ser diferente de DATABASE_URL: os testes apagam o banco.");

  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
    await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
    await pool.query("CREATE SCHEMA public");
    await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  } finally {
    await pool.end();
  }
}
