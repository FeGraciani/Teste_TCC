import type { Role } from "./roles";

/**
 * Os três portais de entrada. A chave aparece na URL (/entrar?perfil=…).
 */
export const PORTALS = {
  paciente: {
    role: "PATIENT",
    label: "Paciente",
    title: "Que bom ter você aqui",
    description: "Entre para agendar consultas, conversar com seu profissional e decidir o que cada um pode ver sobre você.",
  },
  profissional: {
    role: "PROFESSIONAL",
    label: "Profissional",
    title: "Acesso do profissional",
    description: "Sua agenda, seus horários de trabalho, as mensagens dos pacientes e os prontuários.",
  },
  administracao: {
    role: "ADMIN",
    label: "Administração",
    title: "Gestão da clínica",
    description: "Profissionais, serviços e valores, consultas e auditoria. A administração não tem acesso a prontuários.",
  },
} as const satisfies Record<string, { role: Role; label: string; title: string; description: string }>;

export type PortalKey = keyof typeof PORTALS;

export const PORTAL_KEYS = Object.keys(PORTALS) as PortalKey[];

export function isPortalKey(value: unknown): value is PortalKey {
  // Object.hasOwn: "toString", "constructor" etc. não são portais.
  return typeof value === "string" && Object.hasOwn(PORTALS, value);
}

/** Portal de entrada de cada perfil. */
export function portalOfRole(role: Role): PortalKey {
  return PORTAL_KEYS.find((key) => PORTALS[key].role === role) ?? "paciente";
}
