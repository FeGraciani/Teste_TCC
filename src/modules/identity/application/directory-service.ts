import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { getWeeklyBlocks } from "@/modules/scheduling/application/availability-service";
import { db } from "@/shared/infrastructure/database/client";
import { professionalProfiles, users } from "@/shared/infrastructure/database/schema";
import type { Specialty } from "@/modules/clinical-records/domain/record-access";

export type PublicProfessional = {
  id: string;
  displayName: string;
  title: string;
  specialty: Specialty;
  registry: string;
  bio: string;
  focusAreas: string[];
  acceptsOnline: boolean;
  acceptsInPerson: boolean;
  hasSchedule: boolean;
};

/** Equipe exibida no site e na escolha de profissional (somente ativos). */
export async function listPublicProfessionals(specialty?: Specialty): Promise<PublicProfessional[]> {
  const rows = await db
    .select({
      id: professionalProfiles.id,
      displayName: professionalProfiles.displayName,
      title: professionalProfiles.title,
      specialty: professionalProfiles.specialty,
      registry: professionalProfiles.registry,
      bio: professionalProfiles.bio,
      focusAreas: professionalProfiles.focusAreas,
      acceptsOnline: professionalProfiles.acceptsOnline,
      acceptsInPerson: professionalProfiles.acceptsInPerson,
    })
    .from(professionalProfiles)
    .innerJoin(users, eq(users.id, professionalProfiles.userId))
    .where(and(eq(users.active, true), specialty ? eq(professionalProfiles.specialty, specialty) : undefined))
    .orderBy(asc(professionalProfiles.specialty), asc(professionalProfiles.displayName));

  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      hasSchedule: (await getWeeklyBlocks(row.id)).some((block) => block.kind === "APPOINTMENTS"),
    })),
  );
}
