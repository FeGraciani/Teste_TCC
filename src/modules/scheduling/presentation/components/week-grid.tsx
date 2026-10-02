import Link from "next/link";
import { cn } from "@/shared/lib/cn";
import { capitalize, dateKeyParts, formatDateKeyLong, formatTime, minutesToClock } from "@/shared/lib/datetime";
import type { ProfessionalWeek, WeekAppointment } from "../../application/agenda-service";

const HOUR_REM = 3.5;

const APPOINTMENT_TONES: Record<WeekAppointment["status"], string> = {
  SCHEDULED: "bg-quaresmeira-700 text-white hover:bg-quaresmeira-800",
  COMPLETED: "bg-folha-600 text-white hover:bg-folha-700",
  NO_SHOW: "bg-ipe-300 text-tinta hover:bg-ipe-400",
  CANCELLED: "bg-nevoa-escura text-pedra",
};

const STRIPES = "bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgb(31_28_48/0.05)_6px_12px)]";

/** Grade semanal: períodos de trabalho, ausências e consultas (telas médias e grandes). */
export function WeekGrid({ week, today }: { week: ProfessionalWeek; today: string }) {
  const { firstMinute, lastMinute } = week;
  const hours = Array.from({ length: (lastMinute - firstMinute) / 60 + 1 }, (_, index) => firstMinute + index * 60);
  const height = ((lastMinute - firstMinute) / 60) * HOUR_REM;
  const position = (start: number, end: number) => {
    const top = Math.max(start, firstMinute);
    const bottom = Math.min(end, lastMinute);
    return { top: `${((top - firstMinute) / 60) * HOUR_REM}rem`, height: `${Math.max(0, ((bottom - top) / 60) * HOUR_REM)}rem` };
  };

  return (
    <div className="overflow-x-auto rounded-[1.25rem] border border-linha bg-papel">
      <div className="grid min-w-[52rem] grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
        <div className="border-b border-linha" />
        {week.days.map((day) => {
          const parts = dateKeyParts(day.dateKey);
          const isToday = day.dateKey === today;
          return (
            <div key={day.dateKey} className="border-b border-l border-linha px-2 py-2.5 text-center">
              <p className={cn("text-xs font-semibold", isToday ? "text-quaresmeira-700" : "text-pedra")}>{parts.weekday}</p>
              <p
                className={cn(
                  "mx-auto mt-0.5 grid size-8 place-items-center rounded-full text-lg font-bold",
                  isToday && "bg-quaresmeira-700 text-white",
                )}
              >
                {parts.day}
              </p>
            </div>
          );
        })}

        <div className="relative" style={{ height: `${height}rem` }} aria-hidden>
          {hours.slice(0, -1).map((minute, index) => (
            <span
              key={minute}
              className={cn("absolute right-2 text-xs text-pedra", index === 0 ? "translate-y-1" : "-translate-y-1/2")}
              style={{ top: `${((minute - firstMinute) / 60) * HOUR_REM}rem` }}
            >
              {minutesToClock(minute)}
            </span>
          ))}
        </div>

        {week.days.map((day) => (
          <div
            key={day.dateKey}
            className="relative border-l border-linha"
            style={{ height: `${height}rem` }}
            aria-label={capitalize(formatDateKeyLong(day.dateKey))}
            role="group"
          >
            {hours.slice(1, -1).map((minute) => (
              <div
                key={minute}
                className="absolute inset-x-0 border-t border-linha/60"
                style={{ top: `${((minute - firstMinute) / 60) * HOUR_REM}rem` }}
              />
            ))}

            {day.blocks.map((block) => (
              <div
                key={`${block.startMinute}-${block.kind}`}
                className={cn(
                  "absolute inset-x-1 rounded-lg px-1.5 py-1 text-[0.7rem] font-semibold",
                  block.kind === "APPOINTMENTS"
                    ? "bg-folha-50 text-folha-700 ring-1 ring-inset ring-folha-100"
                    : cn("bg-nevoa-escura text-pedra", STRIPES),
                )}
                style={position(block.startMinute, block.endMinute)}
              >
                {block.kind === "APPOINTMENTS" ? "Atendimento" : (block.label ?? "Trabalho interno")}
              </div>
            ))}

            {day.absences.map((absence) => (
              <div
                key={`${absence.startMinute}-${absence.endMinute}`}
                className={cn(
                  "absolute inset-x-1 z-10 rounded-lg bg-urucum-50 px-1.5 py-1 text-[0.7rem] font-semibold text-urucum-700 ring-1 ring-inset ring-urucum-100",
                  STRIPES,
                )}
                style={position(absence.startMinute, absence.endMinute)}
              >
                Ausência{absence.reason ? `: ${absence.reason}` : ""}
              </div>
            ))}

            {day.appointments.map((appointment) => (
              <Link
                key={appointment.id}
                href={`/profissional/pacientes/${appointment.patient.id}`}
                className={cn(
                  "absolute inset-x-1 z-20 overflow-hidden rounded-lg px-1.5 py-1 text-[0.72rem] leading-tight shadow-suave",
                  APPOINTMENT_TONES[appointment.status],
                )}
                style={position(appointment.startMinute, appointment.endMinute)}
                title={`${formatTime(appointment.startsAt)} — ${appointment.patient.displayName} (${appointment.serviceName})`}
              >
                <span className="block font-bold">{formatTime(appointment.startsAt)}</span>
                <span className="block truncate">{appointment.patient.displayName}</span>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Legenda das cores da grade. */
export function WeekLegend() {
  const items = [
    ["bg-folha-50 ring-1 ring-folha-100", "Horário de atendimento (aberto para agendamento)"],
    [cn("bg-nevoa-escura", STRIPES), "Trabalho interno (não aparece para pacientes)"],
    [cn("bg-urucum-50 ring-1 ring-urucum-100", STRIPES), "Ausência"],
    ["bg-quaresmeira-700", "Consulta agendada"],
    ["bg-folha-600", "Realizada"],
    ["bg-ipe-300", "Falta"],
  ] as const;
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-pedra">
      {items.map(([swatch, label]) => (
        <li key={label} className="flex items-center gap-2">
          <span className={cn("size-3.5 rounded", swatch)} aria-hidden />
          {label}
        </li>
      ))}
    </ul>
  );
}
