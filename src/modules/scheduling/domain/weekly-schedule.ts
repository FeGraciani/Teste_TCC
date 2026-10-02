import { minutesToClock, WEEKDAYS } from "@/shared/lib/datetime";
import type { WeeklyBlock } from "./availability";

export const MAX_BLOCKS_PER_DAY = 12;
export const MIN_BLOCK_MINUTES = 15;

/**
 * Valida a grade semanal do profissional. Retorna uma lista de problemas
 * em português (vazia quando está tudo certo).
 */
export function validateWeeklyBlocks(blocks: WeeklyBlock[]): string[] {
  const problems: string[] = [];

  for (const block of blocks) {
    const day = WEEKDAYS.find((weekday) => weekday.iso === block.weekday);
    const where = day ? `${day.long} (${minutesToClock(block.startMinute)}–${minutesToClock(block.endMinute)})` : "Período";
    if (!day) problems.push("Dia da semana inválido.");
    if (!Number.isInteger(block.startMinute) || !Number.isInteger(block.endMinute)) {
      problems.push(`${where}: horários inválidos.`);
      continue;
    }
    if (block.startMinute < 0 || block.endMinute > 24 * 60) problems.push(`${where}: o horário precisa estar entre 00:00 e 24:00.`);
    if (block.endMinute <= block.startMinute) problems.push(`${where}: o fim precisa ser depois do início.`);
    else if (block.endMinute - block.startMinute < MIN_BLOCK_MINUTES) {
      problems.push(`${where}: cada período precisa ter pelo menos ${MIN_BLOCK_MINUTES} minutos.`);
    }
    if (block.startMinute % 5 !== 0 || block.endMinute % 5 !== 0) problems.push(`${where}: use horários múltiplos de 5 minutos.`);
  }

  for (const day of WEEKDAYS) {
    const ofDay = blocks.filter((block) => block.weekday === day.iso).sort((a, b) => a.startMinute - b.startMinute);
    if (ofDay.length > MAX_BLOCKS_PER_DAY) problems.push(`${day.long}: no máximo ${MAX_BLOCKS_PER_DAY} períodos por dia.`);
    for (let i = 1; i < ofDay.length; i++) {
      if (ofDay[i].startMinute < ofDay[i - 1].endMinute) {
        problems.push(
          `${day.long}: os períodos ${minutesToClock(ofDay[i - 1].startMinute)}–${minutesToClock(ofDay[i - 1].endMinute)} e ${minutesToClock(ofDay[i].startMinute)}–${minutesToClock(ofDay[i].endMinute)} se sobrepõem.`,
        );
      }
    }
  }

  return [...new Set(problems)];
}

/** Total semanal de horas por tipo, para o resumo da tela de horários. */
export function weeklyTotals(blocks: WeeklyBlock[]): { appointmentsMinutes: number; internalMinutes: number } {
  return blocks.reduce(
    (totals, block) => {
      const minutes = Math.max(0, block.endMinute - block.startMinute);
      if (block.kind === "APPOINTMENTS") totals.appointmentsMinutes += minutes;
      else totals.internalMinutes += minutes;
      return totals;
    },
    { appointmentsMinutes: 0, internalMinutes: 0 },
  );
}

export function formatHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, "0")}`;
}
