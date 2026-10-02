import { CLINIC_LOCALE, CLINIC_TIME_ZONE } from "@/config/clinic";

/**
 * Formatação de datas sempre no fuso da clínica — funciona igual no
 * servidor (que costuma rodar em UTC) e no navegador do paciente.
 */

type DateInput = Date | string | number;

const toDate = (value: DateInput): Date => (value instanceof Date ? value : new Date(value));

const formatters = {
  time: new Intl.DateTimeFormat(CLINIC_LOCALE, { timeZone: CLINIC_TIME_ZONE, hour: "2-digit", minute: "2-digit" }),
  date: new Intl.DateTimeFormat(CLINIC_LOCALE, { timeZone: CLINIC_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" }),
  dayMonth: new Intl.DateTimeFormat(CLINIC_LOCALE, { timeZone: CLINIC_TIME_ZONE, day: "numeric", month: "short" }),
  weekdayLong: new Intl.DateTimeFormat(CLINIC_LOCALE, { timeZone: CLINIC_TIME_ZONE, weekday: "long", day: "numeric", month: "long" }),
  weekdayShort: new Intl.DateTimeFormat(CLINIC_LOCALE, { timeZone: CLINIC_TIME_ZONE, weekday: "short", day: "2-digit", month: "2-digit" }),
  monthYear: new Intl.DateTimeFormat(CLINIC_LOCALE, { timeZone: CLINIC_TIME_ZONE, month: "long", year: "numeric" }),
  weekdayOnly: new Intl.DateTimeFormat(CLINIC_LOCALE, { timeZone: CLINIC_TIME_ZONE, weekday: "short" }),
  dayOnly: new Intl.DateTimeFormat(CLINIC_LOCALE, { timeZone: CLINIC_TIME_ZONE, day: "numeric" }),
  monthOnly: new Intl.DateTimeFormat(CLINIC_LOCALE, { timeZone: CLINIC_TIME_ZONE, month: "short" }),
  parts: new Intl.DateTimeFormat("en-CA", { timeZone: CLINIC_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }),
  hourParts: new Intl.DateTimeFormat("en-GB", { timeZone: CLINIC_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
};

/** "14:00" */
export const formatTime = (value: DateInput) => formatters.time.format(toDate(value));

/** "02/10/2026" */
export const formatDate = (value: DateInput) => formatters.date.format(toDate(value));

/** "2 de out." */
export const formatDayMonth = (value: DateInput) => formatters.dayMonth.format(toDate(value));

/** "quinta-feira, 2 de outubro" */
export const formatWeekdayLong = (value: DateInput) => formatters.weekdayLong.format(toDate(value));

/** "qui., 02/10" */
export const formatWeekdayShort = (value: DateInput) => formatters.weekdayShort.format(toDate(value));

/** "outubro de 2026" */
export const formatMonthYear = (value: DateInput) => formatters.monthYear.format(toDate(value));

/** "02/10/2026 às 14:00" */
export const formatDateTime = (value: DateInput) => `${formatDate(value)} às ${formatTime(value)}`;

/** Partes para o "bloquinho de calendário": { weekday: "sex.", day: "3", month: "out." } */
export function dateParts(value: DateInput): { weekday: string; day: string; month: string } {
  const date = toDate(value);
  return {
    weekday: formatters.weekdayOnly.format(date),
    day: formatters.dayOnly.format(date),
    month: formatters.monthOnly.format(date),
  };
}

/** Data civil (AAAA-MM-DD) em texto: "segunda-feira, 5 de outubro". Meio-dia evita virar o dia por fuso. */
export function formatDateKeyLong(dateKey: string): string {
  return formatWeekdayLong(new Date(`${dateKey}T12:00:00-03:00`));
}

/** Data civil (AAAA-MM-DD) em partes, para os seletores de dia. */
export function dateKeyParts(dateKey: string): { weekday: string; day: string; month: string } {
  return dateParts(new Date(`${dateKey}T12:00:00-03:00`));
}

/** Data civil no fuso da clínica, no formato AAAA-MM-DD. */
export function toDateKey(value: DateInput): string {
  return formatters.parts.format(toDate(value));
}

/** Minutos desde a meia-noite (no fuso da clínica). */
export function minutesOfDay(value: DateInput): number {
  const [h, m] = formatters.hourParts.format(toDate(value)).split(":").map(Number);
  return h * 60 + m;
}

/** "Hoje", "Amanhã" ou "quinta-feira, 2 de outubro". */
export function relativeDayLabel(value: DateInput, now: DateInput = new Date()): string {
  const key = toDateKey(value);
  const today = toDateKey(now);
  if (key === today) return "Hoje";
  const tomorrow = toDateKey(toDate(now).getTime() + 24 * 60 * 60 * 1000);
  if (key === tomorrow) return "Amanhã";
  return capitalize(formatWeekdayLong(value));
}

/** "09:30" a partir de minutos desde a meia-noite. */
export function minutesToClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 570 a partir de "09:30" (ou null se inválido). */
export function clockToMinutes(clock: string): number | null {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(clock.trim());
  if (!match) return clock.trim() === "24:00" ? 1440 : null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const WEEKDAYS = [
  { iso: 1, short: "Seg", long: "Segunda-feira" },
  { iso: 2, short: "Ter", long: "Terça-feira" },
  { iso: 3, short: "Qua", long: "Quarta-feira" },
  { iso: 4, short: "Qui", long: "Quinta-feira" },
  { iso: 5, short: "Sex", long: "Sexta-feira" },
  { iso: 6, short: "Sáb", long: "Sábado" },
  { iso: 7, short: "Dom", long: "Domingo" },
] as const;
