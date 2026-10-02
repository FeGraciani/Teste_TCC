import { CLINIC_LOCALE } from "@/config/clinic";

const brl = new Intl.NumberFormat(CLINIC_LOCALE, { style: "currency", currency: "BRL" });

/** 22000 → "R$ 220,00" */
export function formatBRL(cents: number): string {
  return brl.format(cents / 100);
}

/** "R$ 220,00" ou "220" ou "220,50" → 22000 / 22050 */
export function parseBRLToCents(input: string): number | null {
  const normalized = input
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  if (!normalized) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}
