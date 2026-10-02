import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { recordAudit } from "@/modules/audit/application/audit-service";
import { assertProfessional, type Actor } from "@/shared/application/actor";
import { NotFoundError } from "@/shared/errors";
import { db } from "@/shared/infrastructure/database/client";
import { parseOrThrow } from "@/shared/lib/validation";
import type { Specialty } from "@/modules/clinical-records/domain/record-access";
import { professionalProfiles, users } from "../infrastructure/schema";

export type OwnProfessionalProfile = {
  name: string;
  email: string;
  displayName: string;
  title: string;
  registry: string;
  specialty: Specialty;
  bio: string;
  focusAreas: string[];
};

export async function getOwnProfessionalProfile(actor: Actor): Promise<OwnProfessionalProfile> {
  const professional = assertProfessional(actor);
  const [row] = await db
    .select({
      name: users.name,
      email: users.email,
      displayName: professionalProfiles.displayName,
      title: professionalProfiles.title,
      registry: professionalProfiles.registry,
      specialty: professionalProfiles.specialty,
      bio: professionalProfiles.bio,
      focusAreas: professionalProfiles.focusAreas,
    })
    .from(professionalProfiles)
    .innerJoin(users, eq(users.id, professionalProfiles.userId))
    .where(eq(professionalProfiles.id, professional.professionalId))
    .limit(1);
  if (!row) throw new NotFoundError("Perfil profissional não encontrado.");
  return row;
}

const ownProfileSchema = z.object({
  bio: z.string().trim().max(800, "Use no máximo 800 caracteres.").default(""),
  focusAreas: z
    .string()
    .trim()
    .max(300, "Use no máximo 300 caracteres.")
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 8),
    ),
});

/**
 * O profissional ajusta a própria apresentação (exibida no site e no agendamento).
 * Nome, registro no conselho e especialidade continuam sob responsabilidade da administração.
 */
export async function updateOwnProfessionalProfile(actor: Actor, raw: Record<string, unknown>): Promise<void> {
  const professional = assertProfessional(actor);
  const input = parseOrThrow(ownProfileSchema, raw);
  await db.transaction(async (tx) => {
    await tx
      .update(professionalProfiles)
      .set({ bio: input.bio, focusAreas: input.focusAreas })
      .where(eq(professionalProfiles.id, professional.professionalId));
    await recordAudit({ actor, action: "PROFESSIONAL_PROFILE_UPDATED", entityType: "professional", entityId: professional.professionalId }, tx);
  });
}
