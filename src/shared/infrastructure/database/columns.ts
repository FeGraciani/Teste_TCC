import { timestamp } from "drizzle-orm/pg-core";

/** Colunas de auditoria padrão (sempre com fuso horário). */
export const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const timestamptz = (name: string) => timestamp(name, { withTimezone: true });
