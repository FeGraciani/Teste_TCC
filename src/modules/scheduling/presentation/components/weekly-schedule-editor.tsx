"use client";

import { Copy, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { cn } from "@/shared/lib/cn";
import { INITIAL_ACTION_STATE, type ActionState } from "@/shared/lib/action-state";
import { clockToMinutes, minutesToClock, WEEKDAYS } from "@/shared/lib/datetime";
import { Button } from "@/shared/ui/button";
import type { BlockKind, WeeklyBlock } from "../../domain/availability";
import { formatHours, validateWeeklyBlocks, weeklyTotals } from "../../domain/weekly-schedule";
import { saveWeeklyScheduleAction } from "../actions";

type Row = { key: string; weekday: number; start: string; end: string; kind: BlockKind; label: string };

/** Chave para períodos criados na tela (só chamada em eventos, nunca durante a renderização). */
const newKey = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `novo-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;

function toRows(blocks: WeeklyBlock[]): Row[] {
  return blocks.map((block, index) => ({
    key: `salvo-${index}`,
    weekday: block.weekday,
    start: minutesToClock(block.startMinute),
    end: minutesToClock(block.endMinute),
    kind: block.kind,
    label: block.label ?? "",
  }));
}

function toBlocks(rows: Row[]): WeeklyBlock[] {
  return rows.map((row) => ({
    weekday: row.weekday,
    startMinute: clockToMinutes(row.start) ?? -1,
    endMinute: clockToMinutes(row.end) ?? -1,
    kind: row.kind,
    label: row.kind === "INTERNAL" && row.label.trim() ? row.label.trim() : null,
  }));
}

/**
 * Grade semanal do profissional. "Atendimento" abre horários para os
 * pacientes; "Trabalho interno" ocupa o tempo sem aparecer na agenda pública.
 */
export function WeeklyScheduleEditor({ initialBlocks }: { initialBlocks: WeeklyBlock[] }) {
  const [rows, setRows] = useState<Row[]>(() => toRows(initialBlocks));
  const [saved, setSaved] = useState<Row[]>(rows);
  const [result, setResult] = useState<ActionState>(INITIAL_ACTION_STATE);
  const [pending, startTransition] = useTransition();

  const blocks = toBlocks(rows);
  const problems = validateWeeklyBlocks(blocks);
  const totals = weeklyTotals(blocks.filter((block) => block.startMinute >= 0 && block.endMinute > block.startMinute));
  const dirty = JSON.stringify(toBlocks(saved)) !== JSON.stringify(blocks);

  const update = (key: string, patch: Partial<Row>) => {
    setResult(INITIAL_ACTION_STATE);
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const addPeriod = (weekday: number) => {
    setResult(INITIAL_ACTION_STATE);
    setRows((current) => {
      const ofDay = current.filter((row) => row.weekday === weekday).sort((a, b) => a.start.localeCompare(b.start));
      const last = ofDay.at(-1);
      const startMinute = last ? Math.min((clockToMinutes(last.end) ?? 0) + 60, 22 * 60) : 8 * 60;
      return [
        ...current,
        {
          key: newKey(),
          weekday,
          start: minutesToClock(startMinute),
          end: minutesToClock(Math.min(startMinute + 4 * 60, 23 * 60 + 55)),
          kind: "APPOINTMENTS",
          label: "",
        },
      ];
    });
  };

  const copyMondayToWeekdays = () => {
    setResult(INITIAL_ACTION_STATE);
    setRows((current) => {
      const monday = current.filter((row) => row.weekday === 1);
      const kept = current.filter((row) => row.weekday === 1 || row.weekday > 5);
      const copies = [2, 3, 4, 5].flatMap((weekday) => monday.map((row) => ({ ...row, key: newKey(), weekday })));
      return [...kept, ...copies];
    });
  };

  const save = () =>
    startTransition(async () => {
      try {
        const response = await saveWeeklyScheduleAction(blocks);
        setResult(response);
        if (response.status === "success") setSaved(rows);
      } catch {
        // Falha de rede: a grade editada continua na tela para salvar de novo.
        setResult({
          status: "error",
          message: "Não foi possível falar com o servidor. Confira sua conexão: a grade continua aqui, é só salvar de novo.",
          at: Date.now(),
        });
      }
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.95rem] text-pedra">
          <span className="font-semibold text-tinta">{formatHours(totals.appointmentsMinutes)}</span> de atendimento e{" "}
          <span className="font-semibold text-tinta">{formatHours(totals.internalMinutes)}</span> de trabalho interno por semana.
        </p>
        <Button variant="secondary" size="sm" onClick={copyMondayToWeekdays}>
          <Copy className="size-4" aria-hidden />
          Copiar segunda para terça a sexta
        </Button>
      </div>

      <ul className="divide-y divide-linha rounded-[1.25rem] border border-linha bg-papel">
        {WEEKDAYS.map((day) => {
          const ofDay = rows.filter((row) => row.weekday === day.iso).sort((a, b) => a.start.localeCompare(b.start));
          return (
            <li key={day.iso} className="grid gap-3 p-4 sm:p-5 lg:grid-cols-[9rem_1fr]">
              <p className="font-bold lg:pt-2">{day.long}</p>
              <div className="space-y-2.5">
                {ofDay.length === 0 && <p className="text-sm text-pedra lg:pt-2.5">Sem expediente</p>}
                {ofDay.map((row) => (
                  <div
                    key={row.key}
                    className={cn(
                      "flex flex-wrap items-end gap-2 rounded-2xl p-2.5",
                      row.kind === "APPOINTMENTS" ? "bg-folha-50" : "bg-nevoa-escura",
                    )}
                  >
                    <label className="space-y-1">
                      <span className="block text-xs font-semibold text-pedra">Início</span>
                      <input
                        type="time"
                        step={300}
                        value={row.start}
                        onChange={(event) => update(row.key, { start: event.target.value })}
                        className="h-10 rounded-lg border border-linha-forte bg-papel px-2 text-[0.95rem]"
                        aria-label={`${day.long}: início do período`}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-xs font-semibold text-pedra">Fim</span>
                      <input
                        type="time"
                        step={300}
                        value={row.end}
                        onChange={(event) => update(row.key, { end: event.target.value })}
                        className="h-10 rounded-lg border border-linha-forte bg-papel px-2 text-[0.95rem]"
                        aria-label={`${day.long}: fim do período`}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-xs font-semibold text-pedra">Tipo</span>
                      <select
                        value={row.kind}
                        onChange={(event) => update(row.key, { kind: event.target.value as BlockKind })}
                        className="h-10 rounded-lg border border-linha-forte bg-papel px-2 text-[0.95rem]"
                        aria-label={`${day.long}: tipo do período`}
                      >
                        <option value="APPOINTMENTS">Atendimento</option>
                        <option value="INTERNAL">Trabalho interno</option>
                      </select>
                    </label>
                    {row.kind === "INTERNAL" && (
                      <label className="min-w-36 flex-1 space-y-1">
                        <span className="block text-xs font-semibold text-pedra">Descrição</span>
                        <input
                          value={row.label}
                          maxLength={40}
                          placeholder="Ex.: supervisão, estudo de caso"
                          onChange={(event) => update(row.key, { label: event.target.value })}
                          className="h-10 w-full rounded-lg border border-linha-forte bg-papel px-2 text-[0.95rem]"
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                      className="ml-auto grid size-10 place-items-center rounded-lg text-pedra hover:bg-urucum-50 hover:text-urucum-700"
                      aria-label={`Remover período de ${day.long}, ${row.start} às ${row.end}`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addPeriod(day.iso)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-quaresmeira-700 hover:bg-quaresmeira-50"
                >
                  <Plus className="size-4" aria-hidden />
                  Adicionar período
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {problems.length > 0 && (
        <div className="rounded-2xl bg-urucum-50 px-4 py-3 text-sm text-urucum-700 ring-1 ring-inset ring-urucum-100" role="alert">
          <p className="font-semibold">Ajuste antes de salvar:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      )}

      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-linha bg-papel p-3",
          dirty && "sticky bottom-3 z-10 bg-papel/95 shadow-flutuante backdrop-blur",
        )}
      >
        <p
          className={cn(
            "text-sm",
            result.status === "error" ? "font-semibold text-urucum-700" : result.status === "success" ? "font-semibold text-folha-700" : "text-pedra",
          )}
          aria-live="polite"
        >
          {result.message ?? (dirty ? "Alterações não salvas. Consultas já marcadas não são afetadas." : "Grade salva.")}
        </p>
        <div className="flex gap-2">
          {dirty && (
            <Button variant="quiet" size="sm" onClick={() => setRows(saved)} disabled={pending}>
              Desfazer
            </Button>
          )}
          <Button size="sm" onClick={save} disabled={!dirty || problems.length > 0 || pending}>
            {pending ? "Salvando…" : "Salvar horários"}
          </Button>
        </div>
      </div>
    </div>
  );
}
