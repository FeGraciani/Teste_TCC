import { CalendarOff, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CLINIC_TIME_ZONE } from "@/config/clinic";
import { requireRole } from "@/modules/identity/application/current-actor";
import { getProfessionalWeek, listProfessionalAgenda, type AgendaItem } from "@/modules/scheduling/application/agenda-service";
import { addDaysToKey, isValidDateKey, todayKey, weekStartKey } from "@/modules/scheduling/domain/availability";
import { AgendaItemCard } from "@/modules/scheduling/presentation/components/agenda-item-card";
import { WeekGrid, WeekLegend } from "@/modules/scheduling/presentation/components/week-grid";
import { cn } from "@/shared/lib/cn";
import type { ProfessionalActor } from "@/shared/application/actor";
import { capitalize, formatDateKeyLong, formatDayMonth, formatTime, toDateKey } from "@/shared/lib/datetime";
import { ButtonLink } from "@/shared/ui/button";
import { EmptyState, PageHeader } from "@/shared/ui/layout";

export const metadata: Metadata = { title: "Agenda" };

const VIEWS = [
  { key: "semana", label: "Semana" },
  { key: "proximas", label: "Próximas" },
  { key: "anteriores", label: "Anteriores" },
] as const;

type ViewKey = (typeof VIEWS)[number]["key"];

function groupByDay(items: AgendaItem[]) {
  const groups = new Map<string, AgendaItem[]>();
  for (const item of items) {
    const key = toDateKey(item.startsAt);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()];
}

export default async function AgendaPage({ searchParams }: PageProps<"/profissional/agenda">) {
  const actor = await requireRole("PROFESSIONAL");
  const params = await searchParams;
  const view: ViewKey = VIEWS.some((item) => item.key === params.ver) ? (params.ver as ViewKey) : "semana";
  const today = todayKey(CLINIC_TIME_ZONE);

  return (
    <>
      <PageHeader
        title="Agenda"
        description="Seus atendimentos, com cada paciente identificado do jeito que ele escolheu."
        actions={
          <>
            <ButtonLink href="/profissional/horarios" variant="secondary">
              <Clock className="size-4" aria-hidden />
              Horários de trabalho
            </ButtonLink>
            <ButtonLink href="/profissional/horarios#ausencias" variant="secondary">
              <CalendarOff className="size-4" aria-hidden />
              Registrar ausência
            </ButtonLink>
          </>
        }
      />

      <nav aria-label="Modo de visualização" className="mb-6">
        <ul className="inline-flex gap-1 rounded-2xl bg-nevoa-escura p-1">
          {VIEWS.map((item) => (
            <li key={item.key}>
              <Link
                href={`/profissional/agenda?ver=${item.key}`}
                aria-current={view === item.key ? "page" : undefined}
                className={cn(
                  "block rounded-xl px-4 py-2 text-[0.95rem] font-semibold",
                  view === item.key ? "bg-papel text-quaresmeira-800 shadow-suave" : "text-pedra hover:text-tinta",
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {view === "semana" && <WeekView actorWeek={await loadWeek(actor, params.semana, today)} today={today} />}
      {view === "proximas" && <UpcomingView items={await listProfessionalAgenda(actor, { scope: "upcoming" })} />}
      {view === "anteriores" && <PastView items={await listProfessionalAgenda(actor, { scope: "past", limit: 100 })} />}
    </>
  );
}

async function loadWeek(actor: ProfessionalActor, raw: string | string[] | undefined, today: string) {
  const requested = isValidDateKey(raw) ? raw : today;
  return getProfessionalWeek(actor, weekStartKey(requested, CLINIC_TIME_ZONE));
}

function WeekView({ actorWeek, today }: { actorWeek: Awaited<ReturnType<typeof getProfessionalWeek>>; today: string }) {
  const start = actorWeek.weekStart;
  const end = addDaysToKey(start, 6, CLINIC_TIME_ZONE);
  const previous = addDaysToKey(start, -7, CLINIC_TIME_ZONE);
  const next = addDaysToKey(start, 7, CLINIC_TIME_ZONE);
  const isCurrentWeek = weekStartKey(today, CLINIC_TIME_ZONE) === start;
  const total = actorWeek.days.reduce((sum, day) => sum + day.appointments.length, 0);

  return (
    <section aria-label="Semana" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link
            href={`/profissional/agenda?ver=semana&semana=${previous}`}
            className="grid size-10 place-items-center rounded-xl hover:bg-papel"
            aria-label="Semana anterior"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <p className="min-w-44 text-center font-bold">
            {formatDayMonth(`${start}T12:00:00-03:00`)} a {formatDayMonth(`${end}T12:00:00-03:00`)}
          </p>
          <Link
            href={`/profissional/agenda?ver=semana&semana=${next}`}
            className="grid size-10 place-items-center rounded-xl hover:bg-papel"
            aria-label="Próxima semana"
          >
            <ChevronRight className="size-5" aria-hidden />
          </Link>
          {!isCurrentWeek && (
            <Link href="/profissional/agenda?ver=semana" className="ml-2 text-sm font-semibold text-quaresmeira-700 hover:underline">
              Voltar para esta semana
            </Link>
          )}
        </div>
        <p className="text-sm text-pedra">
          {total === 0 ? "Nenhuma consulta nesta semana" : total === 1 ? "1 consulta nesta semana" : `${total} consultas nesta semana`}
        </p>
      </div>

      <div className="hidden md:block">
        <WeekGrid week={actorWeek} today={today} />
      </div>

      <div className="space-y-4 md:hidden">
        {actorWeek.days.map((day) => (
          <div key={day.dateKey} className="rounded-[1.25rem] border border-linha bg-papel p-4">
            <p className={cn("font-bold", day.dateKey === today && "text-quaresmeira-700")}>{capitalize(formatDateKeyLong(day.dateKey))}</p>
            {day.appointments.length > 0 ? (
              <ul className="mt-2 divide-y divide-linha">
                {day.appointments.map((appointment) => (
                  <li key={appointment.id}>
                    <Link href={`/profissional/pacientes/${appointment.patient.id}`} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="font-semibold">{appointment.patient.displayName}</span>
                      <span className="text-sm text-pedra">{formatTime(appointment.startsAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-pedra">
                {day.absences.length > 0
                  ? "Ausência registrada"
                  : day.blocks.some((block) => block.kind === "APPOINTMENTS")
                    ? "Sem consultas marcadas"
                    : "Sem atendimento"}
              </p>
            )}
          </div>
        ))}
      </div>

      <WeekLegend />
    </section>
  );
}

function UpcomingView({ items }: { items: AgendaItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Nenhuma consulta marcada"
        action={
          <ButtonLink href="/profissional/horarios" variant="secondary">
            Revisar meus horários
          </ButtonLink>
        }
      >
        Os pacientes só conseguem agendar nos seus horários de atendimento. Confira se a sua grade semanal está aberta.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-8">
      {groupByDay(items).map(([dateKey, dayItems]) => (
        <section key={dateKey} aria-label={capitalize(formatDateKeyLong(dateKey))} className="space-y-3">
          <h2 className="text-lg font-bold">{capitalize(formatDateKeyLong(dateKey))}</h2>
          <div className="space-y-3">
            {dayItems.map((item) => (
              <AgendaItemCard key={item.id} item={item} showDate={false} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function PastView({ items }: { items: AgendaItem[] }) {
  if (items.length === 0)
    return <EmptyState title="Nenhum atendimento anterior">O histórico aparece aqui depois das primeiras consultas.</EmptyState>;
  const pending = items.filter((item) => item.canRecordOutcome);
  return (
    <div className="space-y-8">
      {pending.length > 0 && (
        <section aria-labelledby="pendentes" className="space-y-3">
          <h2 id="pendentes" className="text-lg font-bold">
            Aguardando registro ({pending.length})
          </h2>
          <p className="text-sm text-pedra">
            Marque se a consulta aconteceu ou se o paciente faltou. Isso mantém a agenda e os indicadores corretos.
          </p>
          {pending.map((item) => (
            <AgendaItemCard key={item.id} item={item} />
          ))}
        </section>
      )}
      <section aria-labelledby="historico" className="space-y-3">
        <h2 id="historico" className="text-lg font-bold">
          Histórico
        </h2>
        {items
          .filter((item) => !item.canRecordOutcome)
          .map((item) => (
            <AgendaItemCard key={item.id} item={item} />
          ))}
      </section>
    </div>
  );
}
