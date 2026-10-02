import { MessageCircle, Video } from "lucide-react";
import Link from "next/link";
import { ONLINE_ROOM_OPENS_MINUTES_BEFORE } from "@/config/clinic";
import { cn } from "@/shared/lib/cn";
import { capitalize, formatTime, formatWeekdayLong } from "@/shared/lib/datetime";
import { formatBRL } from "@/shared/lib/money";
import { Avatar, specialtyTone } from "@/shared/ui/avatar";
import { ButtonAnchor } from "@/shared/ui/button";
import { DateTile } from "@/shared/ui/date-tile";
import type { PatientAppointmentView } from "../../application/agenda-service";
import { CancelAppointmentButton } from "./cancel-appointment-button";
import { AppointmentStatusBadge, ModalityLabel } from "./status-badge";

const CANCELLED_BY = {
  PATIENT: "Cancelada por você",
  PROFESSIONAL: "Cancelada pelo profissional",
  ADMIN: "Cancelada pela clínica",
} as const;

function monogramOf(name: string): string {
  const parts = name.replace(/^(Dra?\.)\s+/i, "").split(/\s+/);
  return ((parts[0]?.charAt(0) ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : "")).toUpperCase();
}

/** Consulta vista pelo paciente (próximas e anteriores). */
export function PatientAppointmentCard({ appointment, highlight = false }: { appointment: PatientAppointmentView; highlight?: boolean }) {
  const upcoming = appointment.status === "SCHEDULED";
  const when = `${capitalize(formatWeekdayLong(appointment.startsAt))}, às ${formatTime(appointment.startsAt)}`;

  return (
    <article
      className={cn(
        "flex gap-4 rounded-[1.25rem] border bg-papel p-4 sm:gap-5 sm:p-5",
        highlight ? "border-quaresmeira-300 ring-3 ring-quaresmeira-100" : "border-linha",
      )}
    >
      <DateTile
        date={appointment.startsAt}
        tone={upcoming ? (appointment.professional.specialty === "PSYCHIATRY" ? "green" : "violet") : "neutral"}
      />

      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-lg font-bold">
              {formatTime(appointment.startsAt)} às {formatTime(appointment.endsAt)}
            </p>
            <p className="text-[0.95rem] text-pedra">{appointment.serviceName}</p>
          </div>
          <AppointmentStatusBadge status={appointment.status} />
        </div>

        <div className="flex items-center gap-2.5">
          <Avatar monogram={monogramOf(appointment.professional.displayName)} tone={specialtyTone(appointment.professional.specialty)} size="sm" />
          <p className="min-w-0 text-[0.95rem]">
            <span className="font-semibold">{appointment.professional.displayName}</span>
            <span className="text-pedra">, {appointment.professional.title}</span>
          </p>
        </div>

        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-pedra">
          <ModalityLabel modality={appointment.modality} />
          <span>{appointment.durationMinutes} min</span>
          <span>{formatBRL(appointment.priceCents)}</span>
        </p>

        {appointment.status === "CANCELLED" && (
          <p className="rounded-xl bg-urucum-50 px-3 py-2 text-sm text-urucum-700">
            {appointment.cancelledBy ? CANCELLED_BY[appointment.cancelledBy] : "Cancelada"}
            {appointment.cancellationReason ? `. Motivo: ${appointment.cancellationReason}` : "."}
          </p>
        )}

        {upcoming && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {appointment.canJoin && appointment.meetingUrl && (
              <ButtonAnchor href={appointment.meetingUrl} size="sm" variant="success">
                <Video className="size-4" aria-hidden />
                Entrar na sala
              </ButtonAnchor>
            )}
            <Link
              href={`/paciente/mensagens?com=${appointment.professional.id}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold text-quaresmeira-700 hover:bg-quaresmeira-50"
            >
              <MessageCircle className="size-4" aria-hidden />
              Mensagem
            </Link>
            {appointment.cancel.allowed ? (
              <CancelAppointmentButton
                appointmentId={appointment.id}
                requireReason={false}
                summary={`${when}, com ${appointment.professional.displayName}.`}
              />
            ) : (
              <p className="text-sm text-pedra">{appointment.cancel.reason}</p>
            )}
          </div>
        )}

        {upcoming && appointment.modality === "ONLINE" && !appointment.canJoin && (
          <p className="text-sm text-pedra">A sala online abre {ONLINE_ROOM_OPENS_MINUTES_BEFORE} minutos antes do horário.</p>
        )}
      </div>
    </article>
  );
}
