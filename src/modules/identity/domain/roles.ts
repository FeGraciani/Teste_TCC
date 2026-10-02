export type Role = "PATIENT" | "PROFESSIONAL" | "ADMIN";

export const ROLE_LABELS: Record<Role, string> = {
  PATIENT: "Paciente",
  PROFESSIONAL: "Profissional",
  ADMIN: "Administração",
};

/** Área inicial de cada perfil após o login. */
export const ROLE_HOME: Record<Role, string> = {
  PATIENT: "/paciente",
  PROFESSIONAL: "/profissional",
  ADMIN: "/admin",
};

const ROLE_AREA_PREFIX: Record<Role, string> = {
  PATIENT: "/paciente",
  PROFESSIONAL: "/profissional",
  ADMIN: "/admin",
};

/**
 * Valida o destino pós-login (?next=) para evitar redirecionamento aberto:
 * só caminhos internos e dentro da área do próprio perfil.
 */
export function safeRedirectPath(next: string | null | undefined, role: Role): string {
  const home = ROLE_HOME[role];
  if (!next || typeof next !== "string") return home;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\") || next.includes("://")) return home;
  const prefix = ROLE_AREA_PREFIX[role];
  if (next !== prefix && !next.startsWith(`${prefix}/`) && !next.startsWith(`${prefix}?`)) return home;
  return next;
}
