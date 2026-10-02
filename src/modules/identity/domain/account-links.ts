/**
 * Regras puras dos links de acesso enviados por e-mail (convite para criar a
 * senha e redefinição de senha). Ninguém da clínica escolhe nem vê a senha de
 * outra pessoa: o link vai só para o e-mail do dono da conta.
 */

export type AccountLinkPurpose = "INVITE" | "PASSWORD_RESET";

const HOUR = 60 * 60 * 1000;

export const ACCOUNT_LINK_TTL_MS: Record<AccountLinkPurpose, number> = {
  INVITE: 7 * 24 * HOUR,
  PASSWORD_RESET: 2 * HOUR,
};

export const ACCOUNT_LINK_TTL_LABEL: Record<AccountLinkPurpose, string> = {
  INVITE: "7 dias",
  PASSWORD_RESET: "2 horas",
};

export type AccountLinkState = "valid" | "expired" | "used";

export function accountLinkState(link: { expiresAt: Date; usedAt: Date | null }, now: Date = new Date()): AccountLinkState {
  if (link.usedAt) return "used";
  if (link.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}

export const ACCOUNT_LINK_PROBLEMS: Record<Exclude<AccountLinkState, "valid"> | "invalid", string> = {
  invalid: "Este link não é válido. Confira se copiou o endereço completo ou peça um novo.",
  expired: "Este link expirou. Por segurança, ele vale por pouco tempo. Peça um novo.",
  used: "Este link já foi usado. Se precisar, peça um novo.",
};

/** Mostra só o suficiente para a pessoa reconhecer o e-mail: "h•••••@clinica.com.br". */
export function maskEmail(email: string): string {
  const [local = "", domain] = email.split("@");
  if (!domain || !local) return "•••";
  const hidden = "•".repeat(Math.min(Math.max(local.length - 1, 3), 6));
  return `${local.charAt(0)}${hidden}@${domain}`;
}

/** "Helena Duarte" → "Helena" (para saudações). */
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
