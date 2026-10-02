import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ quiet: true });

/**
 * Cada módulo de negócio é dono das suas tabelas
 * (src/modules/<modulo>/infrastructure/schema.ts).
 * O drizzle-kit lê todos eles para gerar as migrações SQL em /drizzle.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/modules/*/infrastructure/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://alento:alento@localhost:5432/alento",
  },
  strict: true,
  verbose: true,
});
