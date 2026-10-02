import { Monitor, MapPin } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { MODALITY_LABELS, STATUS_LABELS, type AppointmentStatus, type Modality } from "../../domain/appointment-policy";

const STATUS_TONES = {
  SCHEDULED: "violet",
  COMPLETED: "green",
  CANCELLED: "red",
  NO_SHOW: "yellow",
} as const;

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}

export function ModalityLabel({ modality, className }: { modality: Modality; className?: string }) {
  const Icon = modality === "ONLINE" ? Monitor : MapPin;
  return (
    <span className={className ?? "inline-flex items-center gap-1.5 text-sm text-pedra"}>
      <Icon className="size-4" aria-hidden />
      {MODALITY_LABELS[modality]}
    </span>
  );
}
