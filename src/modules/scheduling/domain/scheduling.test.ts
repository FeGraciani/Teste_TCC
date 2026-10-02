import { describe, expect, it } from "vitest";
import { canJoinOnlineRoom, canPatientCancel, canProfessionalCancel, canRecordOutcome, hasCareRelationship } from "./appointment-policy";
import {
  type AvailabilityInput,
  computeAvailableSlots,
  isValidDateKey,
  localDateTimeToInstant,
  type WeeklyBlock,
  weekStartKey,
} from "./availability";
import { validateWeeklyBlocks, weeklyTotals } from "./weekly-schedule";

const TZ = "America/Sao_Paulo";
const at = (iso: string) => new Date(iso);

// 2026-10-05 é uma segunda-feira.
const MONDAY = "2026-10-05";
const mondayMorning: WeeklyBlock[] = [
  { weekday: 1, startMinute: 8 * 60, endMinute: 12 * 60, kind: "APPOINTMENTS" },
  { weekday: 1, startMinute: 13 * 60, endMinute: 14 * 60, kind: "INTERNAL", label: "Supervisão" },
];

function input(overrides: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    timeZone: TZ,
    now: at("2026-10-01T12:00:00-03:00"),
    fromDate: MONDAY,
    toDate: MONDAY,
    blocks: mondayMorning,
    busy: [],
    timeOff: [],
    rules: { durationMinutes: 50, bufferMinutes: 10, slotStepMinutes: 60, minNoticeHours: 12, bookingWindowDays: 45 },
    ...overrides,
  };
}

const times = (slots: ReturnType<typeof computeAvailableSlots>) => slots.map((slot) => slot.time);

describe("computeAvailableSlots", () => {
  it("gera horários só dentro dos blocos de atendimento, no fuso da clínica", () => {
    const slots = computeAvailableSlots(input());
    expect(times(slots)).toEqual(["08:00", "09:00", "10:00", "11:00"]);
    expect(slots[0].startsAt.toISOString()).toBe("2026-10-05T11:00:00.000Z");
    expect(slots[0].dateKey).toBe(MONDAY);
  });

  it("nunca oferece horários de trabalho interno", () => {
    const slots = computeAvailableSlots(input({ rules: { ...input().rules, slotStepMinutes: 30 } }));
    expect(times(slots).some((time) => time.startsWith("13"))).toBe(false);
  });

  it("a sessão inteira precisa caber no bloco", () => {
    const slots = computeAvailableSlots(input({ rules: { ...input().rules, durationMinutes: 90, slotStepMinutes: 30 } }));
    expect(times(slots)).toEqual(["08:00", "08:30", "09:00", "09:30", "10:00", "10:30"]);
  });

  it("respeita consultas marcadas e o intervalo entre atendimentos", () => {
    const busy = [{ start: at("2026-10-05T09:00:00-03:00"), end: at("2026-10-05T09:50:00-03:00") }];
    const slots = computeAvailableSlots(input({ busy, rules: { ...input().rules, slotStepMinutes: 30 } }));
    // 08:30 terminaria 09:20 (conflito); 10:00 começa 10 min após o fim (ok).
    expect(times(slots)).toEqual(["08:00", "10:00", "10:30", "11:00"]);
  });

  it("respeita ausências do profissional", () => {
    const timeOff = [{ start: at("2026-10-05T10:00:00-03:00"), end: at("2026-10-05T23:59:00-03:00") }];
    expect(times(computeAvailableSlots(input({ timeOff })))).toEqual(["08:00", "09:00"]);
  });

  it("respeita a antecedência mínima", () => {
    const now = at("2026-10-04T21:30:00-03:00"); // 12h antes = 09:30 de segunda
    expect(times(computeAvailableSlots(input({ now })))).toEqual(["10:00", "11:00"]);
  });

  it("respeita a janela máxima de agendamento", () => {
    const rules = { ...input().rules, bookingWindowDays: 2 };
    expect(computeAvailableSlots(input({ rules }))).toEqual([]);
  });

  it("percorre vários dias e só usa os dias da semana configurados", () => {
    const slots = computeAvailableSlots(input({ fromDate: "2026-10-05", toDate: "2026-10-12" }));
    expect(new Set(slots.map((slot) => slot.dateKey))).toEqual(new Set(["2026-10-05", "2026-10-12"]));
  });
});

describe("validateWeeklyBlocks", () => {
  it("aceita uma grade válida", () => {
    expect(validateWeeklyBlocks(mondayMorning)).toEqual([]);
  });

  it("detecta sobreposição e horários invertidos", () => {
    const problems = validateWeeklyBlocks([
      { weekday: 2, startMinute: 480, endMinute: 720, kind: "APPOINTMENTS" },
      { weekday: 2, startMinute: 700, endMinute: 800, kind: "INTERNAL" },
      { weekday: 3, startMinute: 600, endMinute: 540, kind: "APPOINTMENTS" },
    ]);
    expect(problems.some((problem) => problem.includes("se sobrepõem"))).toBe(true);
    expect(problems.some((problem) => problem.includes("depois do início"))).toBe(true);
  });

  it("soma horas por tipo", () => {
    expect(weeklyTotals(mondayMorning)).toEqual({ appointmentsMinutes: 240, internalMinutes: 60 });
  });
});

describe("políticas de consulta", () => {
  const appointment = {
    status: "SCHEDULED" as const,
    startsAt: at("2026-10-05T10:00:00-03:00"),
    endsAt: at("2026-10-05T10:50:00-03:00"),
    modality: "ONLINE" as const,
  };

  it("paciente cancela até 24h antes", () => {
    expect(canPatientCancel(appointment, at("2026-10-04T09:59:00-03:00")).allowed).toBe(true);
    expect(canPatientCancel(appointment, at("2026-10-04T10:01:00-03:00")).allowed).toBe(false);
  });

  it("profissional cancela até o fim da consulta", () => {
    expect(canProfessionalCancel(appointment, at("2026-10-05T09:55:00-03:00")).allowed).toBe(true);
    expect(canProfessionalCancel(appointment, at("2026-10-05T11:00:00-03:00")).allowed).toBe(false);
  });

  it("resultado só depois do início", () => {
    expect(canRecordOutcome(appointment, at("2026-10-05T09:00:00-03:00")).allowed).toBe(false);
    expect(canRecordOutcome(appointment, at("2026-10-05T10:30:00-03:00")).allowed).toBe(true);
  });

  it("sala online abre 15 minutos antes", () => {
    expect(canJoinOnlineRoom(appointment, at("2026-10-05T09:44:00-03:00"))).toBe(false);
    expect(canJoinOnlineRoom(appointment, at("2026-10-05T09:46:00-03:00"))).toBe(true);
  });

  it("consultas canceladas não criam vínculo de cuidado", () => {
    expect(hasCareRelationship(["CANCELLED"])).toBe(false);
    expect(hasCareRelationship(["CANCELLED", "SCHEDULED"])).toBe(true);
  });

  it("converte data e hora locais em instante", () => {
    expect(localDateTimeToInstant("2026-10-05", "14:30", TZ)?.toISOString()).toBe("2026-10-05T17:30:00.000Z");
  });

  it("semana começa na segunda-feira", () => {
    expect(weekStartKey("2026-10-01", TZ)).toBe("2026-09-28"); // quinta → segunda anterior
    expect(weekStartKey("2026-10-05", TZ)).toBe("2026-10-05"); // segunda → ela mesma
    expect(weekStartKey("2026-10-11", TZ)).toBe("2026-10-05"); // domingo → segunda anterior
  });

  it("só aceita datas que existem no calendário (URLs adulteradas não derrubam a agenda)", () => {
    expect(isValidDateKey("2026-02-28")).toBe(true);
    expect(isValidDateKey("2028-02-29")).toBe(true);
    expect(isValidDateKey("2026-02-30")).toBe(false);
    expect(isValidDateKey("2026-13-01")).toBe(false);
    expect(isValidDateKey("amanhã")).toBe(false);
    expect(isValidDateKey(["2026-10-01"])).toBe(false);
  });
});
