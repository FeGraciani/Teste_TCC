import type { PortalKey } from "@/modules/identity/domain/portals";

/**
 * Contas criadas pelo "npm run db:seed" para explorar o sistema.
 * Só aparecem na tela de entrada quando DEMO_MODE=true.
 * O domínio .example é reservado (RFC 2606): nenhum e-mail real é usado.
 */
export const DEMO_PASSWORD = "Alento2026";

export const DEMO_ACCOUNTS: Record<PortalKey, { label: string; email: string }[]> = {
  paciente: [
    { label: "Mariana — modo Discreto, com exceção para a psiquiatra", email: "mariana@alento.example" },
    { label: "João — modo Anônimo (aparece como codinome)", email: "joao@alento.example" },
  ],
  profissional: [
    { label: "Dra. Helena Duarte — psiquiatra", email: "helena@alento.example" },
    { label: "Ana Beatriz Lima — psicóloga", email: "ana@alento.example" },
  ],
  administracao: [{ label: "Administração da clínica", email: "admin@alento.example" }],
};

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}
