import { DateTime } from "luxon";

/**
 * Cálculo de horários disponíveis — função pura, sem banco.
 *
 * Regras:
 *  1. Só blocos do tipo APPOINTMENTS (horário de atendimento) geram horários;
 *     blocos INTERNAL (trabalho interno) nunca são oferecidos ao paciente.
 *  2. Os horários começam no início do bloco e avançam de `slotStepMinutes`
 *     em `slotStepMinutes`; a sessão inteira precisa caber no bloco.
 *  3. Respeita consultas já marcadas (+ intervalo entre atendimentos),
 *     ausências do profissional, antecedência mínima e janela de agendamento.
 *  4. Tudo é calculado no fuso da clínica (dias da semana e horários locais).
 */

export type BlockKind = "APPOINTMENTS" | "INTERNAL";

export type WeeklyBlock = {
  /** 1 = segunda … 7 = domingo (ISO 8601) */
  weekday: number;
  /** minutos desde 00:00 */
  startMinute: number;
  endMinute: number;
  kind: BlockKind;
  label?: string | null;
};

export type TimeRange = { start: Date; end: Date };

export type SlotRules = {
  durationMinutes: number;
  bufferMinutes: number;
  slotStepMinutes: number;
  minNoticeHours: number;
  bookingWindowDays: number;
};

export type AvailabilityInput = {
  timeZone: string;
  now: Date;
  /** Primeiro dia (AAAA-MM-DD, fuso da clínica), inclusive. */
  fromDate: string;
  /** Último dia (AAAA-MM-DD, fuso da clínica), inclusive. */
  toDate: string;
  blocks: WeeklyBlock[];
  /** Consultas ativas já marcadas com o profissional. */
  busy: TimeRange[];
  timeOff: TimeRange[];
  rules: SlotRules;
};

export type Slot = {
  startsAt: Date;
  endsAt: Date;
  /** AAAA-MM-DD no fuso da clínica */
  dateKey: string;
  /** "09:00" no fuso da clínica */
  time: string;
};

const MINUTE = 60_000;

function overlaps(startMs: number, endMs: number, range: TimeRange, marginMs = 0): boolean {
  return range.start.getTime() - marginMs < endMs && range.end.getTime() + marginMs > startMs;
}

export function computeAvailableSlots(input: AvailabilityInput): Slot[] {
  const { timeZone, now, rules } = input;
  if (rules.durationMinutes <= 0 || rules.slotStepMinutes <= 0) return [];

  const nowLocal = DateTime.fromJSDate(now, { zone: timeZone });
  const earliestStartMs = now.getTime() + rules.minNoticeHours * 60 * MINUTE;
  const lastBookableDay = nowLocal.startOf("day").plus({ days: rules.bookingWindowDays });
  const durationMs = rules.durationMinutes * MINUTE;
  const bufferMs = rules.bufferMinutes * MINUTE;

  const appointmentBlocks = input.blocks.filter((block) => block.kind === "APPOINTMENTS");
  let day = DateTime.fromISO(input.fromDate, { zone: timeZone }).startOf("day");
  const lastDay = DateTime.fromISO(input.toDate, { zone: timeZone }).startOf("day");
  const slots: Slot[] = [];

  while (day <= lastDay && day <= lastBookableDay) {
    const blocksOfDay = appointmentBlocks.filter((block) => block.weekday === day.weekday);

    for (const block of blocksOfDay) {
      for (let minute = block.startMinute; minute + rules.durationMinutes <= block.endMinute; minute += rules.slotStepMinutes) {
        // set() (e não plus) para respeitar a hora de parede em fusos com horário de verão.
        const start = day.set({ hour: Math.floor(minute / 60), minute: minute % 60, second: 0, millisecond: 0 });
        const startMs = start.toMillis();
        const endMs = startMs + durationMs;

        if (startMs < earliestStartMs) continue;
        if (input.timeOff.some((range) => overlaps(startMs, endMs, range))) continue;
        if (input.busy.some((range) => overlaps(startMs, endMs, range, bufferMs))) continue;

        slots.push({
          startsAt: new Date(startMs),
          endsAt: new Date(endMs),
          dateKey: start.toISODate()!,
          time: start.toFormat("HH:mm"),
        });
      }
    }
    day = day.plus({ days: 1 });
  }

  slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  // Remove duplicatas caso dois blocos gerem o mesmo início.
  return slots.filter((slot, index) => index === 0 || slot.startsAt.getTime() !== slots[index - 1].startsAt.getTime());
}

/** Agrupa horários por dia, preservando a ordem. */
export function groupSlotsByDay(slots: Slot[]): { dateKey: string; slots: Slot[] }[] {
  const groups = new Map<string, Slot[]>();
  for (const slot of slots) {
    const list = groups.get(slot.dateKey) ?? [];
    list.push(slot);
    groups.set(slot.dateKey, list);
  }
  return [...groups.entries()].map(([dateKey, list]) => ({ dateKey, slots: list }));
}

/** Data de hoje (AAAA-MM-DD) no fuso informado. */
export function todayKey(timeZone: string, now: Date = new Date()): string {
  return DateTime.fromJSDate(now, { zone: timeZone }).toISODate()!;
}

/** Data civil (AAAA-MM-DD) que existe de verdade no calendário (recusa 2026-02-30, 2026-13-01…). */
export function isValidDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && DateTime.fromISO(value).isValid;
}

/** Segunda-feira da semana de uma data civil (semanas ISO começam na segunda). */
export function weekStartKey(dateKey: string, timeZone: string): string {
  return DateTime.fromISO(dateKey, { zone: timeZone }).startOf("week").toISODate()!;
}

/** Soma dias a uma data civil (AAAA-MM-DD). */
export function addDaysToKey(dateKey: string, days: number, timeZone: string): string {
  return DateTime.fromISO(dateKey, { zone: timeZone }).plus({ days }).toISODate()!;
}

/** Converte data civil + hora local em instante (Date). Retorna null se inválido. */
export function localDateTimeToInstant(dateKey: string, time: string, timeZone: string): Date | null {
  const value = DateTime.fromISO(`${dateKey}T${time}`, { zone: timeZone });
  return value.isValid ? value.toJSDate() : null;
}

/** Limites [início, fim) de um dia civil no fuso informado. */
export function dayBounds(dateKey: string, timeZone: string): TimeRange {
  const start = DateTime.fromISO(dateKey, { zone: timeZone }).startOf("day");
  return { start: start.toJSDate(), end: start.plus({ days: 1 }).toJSDate() };
}
