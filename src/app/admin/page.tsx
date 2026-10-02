import { CalendarCheck2, CalendarClock, CalendarX2, KeyRound, ShieldCheck, Stethoscope, UserRoundX, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { getAdminOverview, listAppointmentsForAdmin } from "@/modules/administration/application/administration-service";
import { requireRole } from "@/modules/identity/application/current-actor";
import { AppointmentStatusBadge } from "@/modules/scheduling/presentation/components/status-badge";
import { capitalize, formatTime, relativeDayLabel } from "@/shared/lib/datetime";
import { formatBRL } from "@/shared/lib/money";
import { ButtonLink } from "@/shared/ui/button";
import { Callout } from "@/shared/ui/callout";
import { PageHeader, Panel } from "@/shared/ui/layout";

export const metadata: Metadata = { title: "Visão geral" };

export default async function AdminHomePage() {
  const actor = await requireRole("ADMIN");
  const [overview, upcoming] = await Promise.all([getAdminOverview(actor), listAppointmentsForAdmin(actor, { scope: "upcoming", limit: 8 })]);

  return (
    <>
      <PageHeader
        title="Visão geral"
        description="Indicadores da clínica. Nenhum dado clínico é usado nestes números."
        actions={
          <>
            <ButtonLink href="/admin/profissionais/novo">Cadastrar profissional</ButtonLink>
            <ButtonLink href="/admin/servicos" variant="secondary">
              Ajustar valores
            </ButtonLink>
          </>
        }
      />

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={<Users className="size-5" aria-hidden />} label="Pacientes ativos" value={overview.activePatients} />
        <Stat icon={<Stethoscope className="size-5" aria-hidden />} label="Profissionais ativos" value={overview.activeProfessionals} />
        <Stat icon={<CalendarClock className="size-5" aria-hidden />} label="Consultas nos próximos 7 dias" value={overview.appointmentsNext7Days} />
        <Stat icon={<CalendarCheck2 className="size-5" aria-hidden />} label="Realizadas nos últimos 30 dias" value={overview.completedLast30Days} />
        <Stat icon={<CalendarX2 className="size-5" aria-hidden />} label="Canceladas nos últimos 30 dias" value={overview.cancelledLast30Days} />
        <Stat icon={<UserRoundX className="size-5" aria-hidden />} label="Faltas nos últimos 30 dias" value={overview.noShowLast30Days} />
        <Stat
          icon={<KeyRound className="size-5" aria-hidden />}
          label="Pedidos de acesso aguardando pacientes"
          value={overview.pendingAccessRequests}
        />
      </ul>

      <Callout className="my-8" title="A administração não vê prontuários">
        <span className="inline-flex gap-2">
          <ShieldCheck className="mt-0.5 hidden size-4 shrink-0 sm:block" aria-hidden />
          Por desenho do sistema, esta área não acessa prontuários, informações de saúde nem as mensagens entre pacientes e profissionais. Esses dados
          ficam criptografados e só os profissionais com vínculo de cuidado os leem.
        </span>
      </Callout>

      <Panel
        title="Próximas consultas"
        actions={
          <Link href="/admin/consultas" className="text-sm font-semibold text-quaresmeira-700 hover:underline">
            Ver agenda completa
          </Link>
        }
      >
        {upcoming.length > 0 ? (
          <ul className="divide-y divide-linha">
            {upcoming.map((appointment) => (
              <li key={appointment.id} className="grid gap-1 py-3 md:grid-cols-[11rem_1fr_1fr_auto] md:items-center md:gap-4">
                <p className="font-semibold">
                  {capitalize(relativeDayLabel(appointment.startsAt))}, {formatTime(appointment.startsAt)}
                </p>
                <p className="min-w-0 truncate">{appointment.patientName}</p>
                <p className="min-w-0 truncate text-pedra">
                  {appointment.professionalName}, {appointment.serviceName}
                </p>
                <p className="flex items-center gap-2 text-sm md:justify-end">
                  <span className="text-pedra">{formatBRL(appointment.priceCents)}</span>
                  <AppointmentStatusBadge status={appointment.status} />
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-pedra">Nenhuma consulta marcada.</p>
        )}
      </Panel>
    </>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <li className="flex items-center gap-4 rounded-[1.25rem] border border-linha bg-papel p-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-quaresmeira-50 text-quaresmeira-700">{icon}</span>
      <span>
        <span className="block text-[1.7rem] leading-none font-extrabold">{value}</span>
        <span className="mt-1 block text-sm text-pedra">{label}</span>
      </span>
    </li>
  );
}
