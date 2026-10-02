import { config } from "dotenv";
import { afterAll } from "vitest";

// Antes de qualquer import do cliente do banco: aponta para o banco de TESTE.
config({ quiet: true });
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 9).toString("base64");

afterAll(async () => {
  const { pool } = await import("@/shared/infrastructure/database/client");
  await pool.end();
});
