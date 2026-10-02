import "server-only";
import { and, asc, eq, type SQL } from "drizzle-orm";
import { z } from "zod";
import { recordAudit } from "@/modules/audit/application/audit-service";
import type { Specialty } from "@/modules/clinical-records/domain/record-access";
import { assertAdmin, type Actor } from "@/shared/application/actor";
import { NotFoundError, ValidationError } from "@/shared/errors";
import { db } from "@/shared/infrastructure/database/client";
import { parseBRLToCents } from "@/shared/lib/money";
import { isUuid, parseOrThrow } from "@/shared/lib/validation";
import { services, type ServiceRow } from "../infrastructure/schema";

export type ServiceSummary = Pick<
  ServiceRow,
  "id" | "slug" | "name" | "description" | "specialty" | "durationMinutes" | "priceCents" | "active" | "sortOrder"
>;

const summaryColumns = {
  id: services.id,
  slug: services.slug,
  name: services.name,
  description: services.description,
  specialty: services.specialty,
  durationMinutes: services.durationMinutes,
  priceCents: services.priceCents,
  active: services.active,
  sortOrder: services.sortOrder,
};

export async function listServices(options: { includeInactive?: boolean; specialty?: Specialty } = {}): Promise<ServiceSummary[]> {
  const conditions: SQL[] = [];
  if (!options.includeInactive) conditions.push(eq(services.active, true));
  if (options.specialty) conditions.push(eq(services.specialty, options.specialty));
  return db
    .select(summaryColumns)
    .from(services)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(services.specialty), asc(services.sortOrder), asc(services.name));
}

export async function getServiceById(id: string): Promise<ServiceSummary | null> {
  if (!isUuid(id)) return null;
  const [row] = await db.select(summaryColumns).from(services).where(eq(services.id, id)).limit(1);
  return row ?? null;
}

const serviceSchema = z.object({
  id: z
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  name: z.string().trim().min(3, "Informe o nome do serviço.").max(80),
  description: z.string().trim().min(10, "Descreva o serviço em uma ou duas frases.").max(400),
  specialty: z.enum(["PSYCHOLOGY", "PSYCHIATRY"], { error: "Escolha a especialidade." }),
  durationMinutes: z.coerce.number().int().min(15, "Mínimo de 15 minutos.").max(240, "Máximo de 4 horas."),
  price: z.string().trim().min(1, "Informe o preço."),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  active: z.enum(["on", "off"]).optional(),
});

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/** Cria ou atualiza um serviço e seu preço (exibido no site em "Valores"). */
export async function saveService(actor: Actor, raw: Record<string, unknown>): Promise<{ id: string }> {
  assertAdmin(actor);
  const input = parseOrThrow(serviceSchema, raw);
  const priceCents = parseBRLToCents(input.price);
  if (priceCents === null) throw new ValidationError("Revise os campos destacados.", { price: ["Informe um valor como 220,00."] });

  const values = {
    name: input.name,
    description: input.description,
    specialty: input.specialty,
    durationMinutes: input.durationMinutes,
    priceCents,
    sortOrder: input.sortOrder,
    active: input.active !== "off",
  };

  let id = input.id;
  if (id) {
    const updated = await db.update(services).set(values).where(eq(services.id, id)).returning({ id: services.id });
    if (updated.length === 0) throw new NotFoundError("Serviço não encontrado.");
  } else {
    let slug = slugify(input.name);
    const [clash] = await db.select({ id: services.id }).from(services).where(eq(services.slug, slug)).limit(1);
    if (clash) slug = `${slug}-${Date.now().toString(36)}`;
    const [created] = await db
      .insert(services)
      .values({ ...values, slug })
      .returning({ id: services.id });
    id = created.id;
  }
  await recordAudit({ actor, action: "SERVICE_SAVED", entityType: "service", entityId: id, metadata: { priceCents } });
  return { id };
}
