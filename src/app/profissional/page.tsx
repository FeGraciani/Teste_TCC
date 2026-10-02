import { CalendarDays, CalendarOff, ClipboardCheck, Clock, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireRole } from "@/modules/identity/application/current-actor";
import { countUnreadMessages } from "@/modules/messaging/application/chat-service";
import { listProfessionalAgenda } from "@/modules/scheduling/application/agenda-service";
import { AgendaItemCard } from "@/modules/scheduling/presentation/components/agenda-item-card";
import { capitalize, formatWeekdayLong, minutesOfDay } from "@/shared/lib/datetime";
import { ButtonLink } from "@/shared/ui/button";
import { EmptyState, Panel } from "@/shared/ui/layout";

export const metadata: Metadata = { title: "Início" };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function greeting(now: Date): string {
  const minutes = minutesOfDay(now);
  if (minutes < 12 * 60) return "Bom dia";
  if (minutes < 18 * 60) return "Boa tarde";
  return "Boa noite";
}

export default async function ProfessionalHomePage() {
  const actor = await requireRole("PROFESSIONAL");
  const now = new Date();
  const [today, upcoming, past, unread] = await Promise.all([
    listProfessionalAgenda(actor, { scope: "today" }, now),
    listProfessionalAgenda(actor, { scope: "upcoming" }, now),
    listProfessionalAgenda(actor, { scope: "past", limit: 100 }, now),
    countUnreadMessages(actor),
  ]);
  const nextWeek = upcoming.filter((item) => item.startsAt.getTime() - now.getTime() < WEEK_MS).length;
  const pendingOutcome = past.filter((item) => item.canRecordOutcome).length;
  const nextAfterToday = upcoming.find((item) => !today.some((todayItem) => todayItem.id === item.id));

  return (
    <div className="space-y-8">
      <header className="space-y-1.5">
        <h1 className="text-[1.9rem] font-bold sm:text-[2.2rem]">
          {greeting(now)}, {actor.displayName}
        </h1>
        <p className="text-[1.02rem] text-pedra">{capitalize(formatWeekdayLong(now))}.</p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={<CalendarDays className="size-5" aria-hidden />}
          label="Consultas hoje"
          value={today.filter((item) => item.status !== "CANCELLED").length}
          href="/profissional/agenda?ver=semana"
        />
        <Stat icon={<Clock className="size-5" aria-hidden />} label="Nos próximos 7 dias" value={nextWeek} href="/profissional/agenda?ver=proximas" />
        <Stat
          icon={<MessageCircle className="size-5" aria-hidden />}
          label="Mensagens não lidas"
          value={unread}
          href="/profissional/mensagens"
          highlight={unread > 0}
        />
        <Stat
          icon={<ClipboardCheck className="size-5" aria-hidden />}
          label="Consultas sem registro de presença"
          value={pendingOutcome}
          href="/profissional/agenda?ver=anteriores"
          highlight={pendingOutcome > 0}
        />
      </ul>

      <Panel
        title="Hoje"
        actions={
          <ButtonLink href="/profissional/horarios#ausencias" variant="secondary" size="sm">
            <CalendarOff className="size-4" aria-hidden />
            Imprevisto? Registrar ausência
          </ButtonLink>
        }
      >
        {today.length > 0 ? (
          <div className="space-y-3">
            {today.map((item) => (
              <AgendaItemCard key={item.id} item={item} showDate={false} />
            ))}
          </div>
        ) : (
          <EmptyState title="Nenhuma consulta hoje">
            {nextAfterToday
              ? "Sua próxima consulta está logo abaixo."
              : "Quando pacientes agendarem nos seus horários de atendimento, as consultas aparecem aqui."}
          </EmptyState>
        )}
      </Panel>

      {nextAfterToday && (
        <Panel
          title="Próxima consulta"
          actions={
            <Link href="/profissional/agenda?ver=proximas" className="text-sm font-semibold text-quaresmeira-700 hover:underline">
              Ver todas
            </Link>
          }
        >
          <AgendaItemCard item={nextAfterToday} />
        </Panel>
      )}
    </div>
  );
}

function Stat({ icon, label, value, href, highlight = false }: { icon: ReactNode; label: string; value: number; href: string; highlight?: boolean }) {
  return (
    <li>
      <Link
        href={href}
        className={
          highlight
            ? "flex h-full items-center gap-4 rounded-[1.25rem] border border-ipe-300 bg-ipe-50 p-4 transition-colors hover:border-ipe-400"
            : "flex h-full items-center gap-4 rounded-[1.25rem] border border-linha bg-papel p-4 transition-colors hover:border-quaresmeira-300"
        }
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-quaresmeira-50 text-quaresmeira-700">{icon}</span>
        <span>
          <span className="block text-[1.7rem] leading-none font-extrabold">{value}</span>
          <span className="mt-1 block text-sm text-pedra">{label}</span>
        </span>
      </Link>
    </li>
  );
}
