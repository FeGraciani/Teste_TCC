import type { Specialty } from "@/modules/clinical-records/domain/record-access";
import type { Role } from "@/modules/identity/domain/roles";
import { ForbiddenError } from "@/shared/errors";

/**
 * Quem está executando um caso de uso. Toda regra de autorização da camada
 * de aplicação recebe o ator explicitamente — nada depende de estado global,
 * o que torna os casos de uso testáveis fora do Next.js.
 */
type BaseActor = {
  userId: string;
  name: string;
  email: string;
  ip?: string | null;
};

export type PatientActor = BaseActor & { role: "PATIENT"; patientId: string };
export type ProfessionalActor = BaseActor & {
  role: "PROFESSIONAL";
  professionalId: string;
  specialty: Specialty;
  displayName: string;
};
export type AdminActor = BaseActor & { role: "ADMIN" };

export type Actor = PatientActor | ProfessionalActor | AdminActor;

export type ActorOfRole<R extends Role> = Extract<Actor, { role: R }>;

export function assertPatient(actor: Actor): PatientActor {
  if (actor.role !== "PATIENT") throw new ForbiddenError("Ação disponível apenas para pacientes.");
  return actor;
}

export function assertProfessional(actor: Actor): ProfessionalActor {
  if (actor.role !== "PROFESSIONAL") throw new ForbiddenError("Ação disponível apenas para profissionais.");
  return actor;
}

export function assertAdmin(actor: Actor): AdminActor {
  if (actor.role !== "ADMIN") throw new ForbiddenError("Ação disponível apenas para a administração.");
  return actor;
}
