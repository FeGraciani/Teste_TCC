import { ClipboardList, MessageCircle, StickyNote, Video } from "lucide-react";
import Link from "next/link";
import { presetLabel } from "@/modules/privacy/domain/privacy-fields";
import { cn } from "@/shared/lib/cn";
import { capitalize, formatTime, formatWeekdayLong } from "@/shared/lib/datetime";
import { Avatar } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { ButtonAnchor } from "@/shared/ui/button";
import type { AgendaItem } from "../../application/agenda-service";
import { CancelAppointmentButton } from "./cancel-appointment-button";
import { OutcomeButtons } from "./outcome-buttons";
import { AppointmentStatusBadge, ModalityLabel } from "./status-badge";

/**
 * Consulta na agenda do profissional. O paciente aparece SEMPRE com o nome
 * que ele autorizou (completo, primeiro nome, iniciais ou codinome).
 */
export function AgendaItemCard({ item, showDate = true }: { item: AgendaItem; showDate?: boolean }) {
  const reserved = item.patient.preset === "ANONYMOUS";
  const when = `${capitalize(formatWeekdayLong(item.startsAt))}, às ${formatTime(item.startsAt)}`;

  return (
    <article
      className={cn("rounded-[1.25rem] border bg-papel p-4 sm:p-5", item.status === "SCHEDULED" ? "border-linha" : "border-linha/70 bg-papel/70")}
    >
      <div className="flex flex-wrap items-start gap-4">
        <div className="w-24 shrink-0">
          <p className="text-xl font-extrabold tracking-[-0.02em]">{formatTime(item.startsAt)}</p>
          <p className="text-sm text-pedra">até {formatTime(item.endsAt)}</p>
          {showDate && <p className="mt-1 text-xs font-semibold text-pedra">{capitalize(formatWeekdayLong(item.startsAt))}</p>}
        </div>

        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <Avatar monogram={item.patient.monogram} tone={reserved ? "mist" : "violet"} />
            <div className="min-w-0">
              <p className="truncate font-bold">{item.patient.displayName}</p>
              <p className="text-sm text-pedra">{item.serviceName}</p>
            </div>
            <Badge tone={reserved ? "violet" : "outline"}>Modo {presetLabel(item.patient.preset).toLowerCase()}</Badge>
            <AppointmentStatusBadge status={item.status} />
          </div>

          <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <ModalityLabel modality={item.modality} />
          </p>

          {item.patientNote && (
            <p className="flex gap-2 rounded-xl bg-nevoa px-3 py-2 text-sm">
              <StickyNote className="mt-0.5 size-4 shrink-0 text-pedra" aria-hidden />
              <span>
                <span className="font-semibold">Recado do paciente: </span>
                {item.patientNote}
              </span>
            </p>
          )}

          {item.status === "CANCELLED" && item.cancellationReason && (
            <p className="rounded-xl bg-urucum-50 px-3 py-2 text-sm text-urucum-700">Motivo do cancelamento: {item.cancellationReason}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {item.canJoin && item.meetingUrl && (
              <ButtonAnchor href={item.meetingUrl} size="sm" variant="success">
                <Video className="size-4" aria-hidden />
                Entrar na sala
              </ButtonAnchor>
            )}
            <Link
              href={`/profissional/pacientes/${item.patient.id}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-quaresmeira-700 hover:bg-quaresmeira-50"
            >
              <ClipboardList className="size-4" aria-hidden />
              Ficha e prontuário
            </Link>
            <Link
              href={`/profissional/mensagens?com=${item.patient.id}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-quaresmeira-700 hover:bg-quaresmeira-50"
            >
              <MessageCircle className="size-4" aria-hidden />
              Mensagem
            </Link>
            {item.canCancel && (
              <CancelAppointmentButton
                appointmentId={item.id}
                requireReason
                summary={`${when}, com ${item.patient.displayName}. O paciente será avisado pelo chat.`}
              />
            )}
          </div>

          {item.canRecordOutcome && (
            <div className="space-y-1.5 border-t border-linha pt-3">
              <p className="text-sm font-semibold text-pedra">Como foi esta consulta?</p>
              <OutcomeButtons appointmentId={item.id} />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
