import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Actor, ActorOfRole } from "@/shared/application/actor";
import { db } from "@/shared/infrastructure/database/client";
import { ROLE_HOME, type Role } from "../domain/roles";
import { patientProfiles, professionalProfiles, sessions, users } from "../infrastructure/schema";
import { readSessionTokenHash, requestIp, touchSession } from "./session";

/**
 * Camada de acesso a dados (DAL) da identidade: é a verificação
 * AUTORITATIVA de sessão. O proxy.ts faz só uma checagem otimista do cookie.
 * Toda página, Server Action e Route Handler protegido passa por aqui.
 */
export const getCurrentActor = cache(async (): Promise<Actor | null> => {
  const tokenHash = await readSessionTokenHash();
  if (!tokenHash) return null;

  const [row] = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      userId: users.id,
      role: users.role,
      name: users.name,
      email: users.email,
      patientId: patientProfiles.id,
      professionalId: professionalProfiles.id,
      specialty: professionalProfiles.specialty,
      displayName: professionalProfiles.displayName,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .leftJoin(patientProfiles, eq(patientProfiles.userId, users.id))
    .leftJoin(professionalProfiles, eq(professionalProfiles.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date()), eq(users.active, true)))
    .limit(1);

  if (!row) return null;
  await touchSession(row.sessionId, row.expiresAt);

  const base = { userId: row.userId, name: row.name, email: row.email, ip: await requestIp() };
  switch (row.role) {
    case "PATIENT":
      return row.patientId ? { ...base, role: "PATIENT", patientId: row.patientId } : null;
    case "PROFESSIONAL":
      return row.professionalId && row.specialty && row.displayName
        ? { ...base, role: "PROFESSIONAL", professionalId: row.professionalId, specialty: row.specialty, displayName: row.displayName }
        : null;
    case "ADMIN":
      return { ...base, role: "ADMIN" };
  }
});

/** Exige login; sem sessão válida, vai para a tela de entrada. */
export async function requireActor(): Promise<Actor> {
  const actor = await getCurrentActor();
  if (!actor) redirect("/entrar");
  return actor;
}

/** Exige um perfil específico; outro perfil é levado para a própria área. */
export async function requireRole<R extends Role>(role: R): Promise<ActorOfRole<R>> {
  const actor = await requireActor();
  if (actor.role !== role) redirect(ROLE_HOME[actor.role]);
  return actor as ActorOfRole<R>;
}
