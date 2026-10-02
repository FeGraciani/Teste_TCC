import type { Metadata } from "next";
import Link from "next/link";
import { listAppointmentsForAdmin } from "@/modules/administration/application/administration-service";
import { requireRole } from "@/modules/identity/application/current-actor";
import { CancelAppointmentButton } from "@/modules/scheduling/presentation/components/cancel-appointment-button";
import { AppointmentStatusBadge, ModalityLabel } from "@/modules/scheduling/presentation/components/status-badge";
import { cn } from "@/shared/lib/cn";
import { capitalize, formatDate, formatTime, formatWeekdayLong } from "@/shared/lib/datetime";
import { formatBRL } from "@/shared/lib/money";
import { EmptyState, PageHeader } from "@/shared/ui/layout";

export const metadata: Metadata = { title: "Consultas" };

export default async function AdminAppointmentsPage({ searchParams }: PageProps<"/admin/consultas">) {
  const actor = await requireRole("ADMIN");
  const params = await searchParams;
  const scope = params.ver === "anteriores" ? "recent" : "upcoming";
  const appointments = await listAppointmentsForAdmin(actor, { scope, limit: 150 });
  const total = appointments.filter((item) => item.status !== "CANCELLED").reduce((sum, item) => sum + item.priceCents, 0);

  return (
    <>
      <PageHeader
        title="Consultas"
        description="Agenda geral da clínica para recepção e cobrança. Para cancelar, informe o motivo: o paciente recebe pelo chat."
      />

      <nav aria-label="Período" className="mb-6">
        <ul className="inline-flex gap-1 rounded-2xl bg-nevoa-escura p-1">
          {[
            { key: "upcoming", href: "/admin/consultas", label: "Próximas" },
            { key: "recent", href: "/admin/consultas?ver=anteriores", label: "Anteriores" },
          ].map((tab) => (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={scope === tab.key ? "page" : undefined}
                className={cn(
                  "block rounded-xl px-4 py-2 text-[0.95rem] font-semibold",
                  scope === tab.key ? "bg-papel text-quaresmeira-800 shadow-suave" : "text-pedra hover:text-tinta",
                )}
              >
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {appointments.length > 0 ? (
        <>
          <p className="mb-3 text-sm text-pedra">
            {appointments.length} {appointments.length === 1 ? "consulta" : "consultas"}, somando {formatBRL(total)} (sem as canceladas).
          </p>
          <ul className="divide-y divide-linha overflow-hidden rounded-[1.25rem] border border-linha bg-papel">
            {appointments.map((appointment) => {
              const cancellable = appointment.canCancel;
              return (
                <li
                  key={appointment.id}
                  className="grid gap-2 p-4 md:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center md:gap-4 sm:px-5"
                >
                  <div>
                    <p className="font-semibold">{formatDate(appointment.startsAt)}</p>
                    <p className="text-sm text-pedra">
                      {capitalize(formatWeekdayLong(appointment.startsAt).split(",")[0] ?? "")}, {formatTime(appointment.startsAt)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{appointment.patientName}</p>
                    <p className="truncate text-sm text-pedra">{appointment.patientEmail}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate">{appointment.professionalName}</p>
                    <p className="flex flex-wrap items-center gap-x-3 text-sm text-pedra">
                      <span>{appointment.serviceName}</span>
                      <ModalityLabel modality={appointment.modality} />
                    </p>
                    {appointment.status === "CANCELLED" && appointment.cancellationReason && (
                      <p className="mt-1 text-sm text-urucum-700">Motivo: {appointment.cancellationReason}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <span className="text-sm text-pedra">{formatBRL(appointment.priceCents)}</span>
                    <AppointmentStatusBadge status={appointment.status} />
                    {cancellable && (
                      <CancelAppointmentButton
                        appointmentId={appointment.id}
                        requireReason
                        label="Cancelar"
                        summary={`${capitalize(formatWeekdayLong(appointment.startsAt))}, às ${formatTime(appointment.startsAt)}: ${appointment.patientName} com ${appointment.professionalName}.`}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <EmptyState title={scope === "upcoming" ? "Nenhuma consulta marcada" : "Nenhuma consulta anterior"} />
      )}
    </>
  );
}
