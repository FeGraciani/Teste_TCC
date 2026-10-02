import { boolean, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "../../../shared/infrastructure/database/columns";
import { specialtyEnum } from "../../identity/infrastructure/schema";

/** Tipos de atendimento oferecidos, com duração e preço (exibidos no site). */
export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  specialty: specialtyEnum("specialty").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  priceCents: integer("price_cents").notNull(),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type ServiceRow = typeof services.$inferSelect;
