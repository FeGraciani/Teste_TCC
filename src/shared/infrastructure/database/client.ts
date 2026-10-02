import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
/** Qualquer executor de consultas: o banco ou uma transação aberta. */
export type Executor = Database | Transaction;

const globalForDb = globalThis as unknown as {
  alentoPool?: Pool;
  alentoDb?: Database;
};

function createPool(): Pool {
  // O Pool não abre conexão ao ser criado: a primeira conexão acontece na
  // primeira consulta. Por isso o build não exige banco disponível.
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
  });
}

export const pool: Pool = globalForDb.alentoPool ?? createPool();
export const db: Database = globalForDb.alentoDb ?? drizzle(pool, { schema });

if (process.env.NODE_ENV !== "production") {
  // Evita abrir um pool novo a cada hot reload em desenvolvimento.
  globalForDb.alentoPool = pool;
  globalForDb.alentoDb = db;
}
