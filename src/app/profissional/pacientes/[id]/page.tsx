import { ArrowLeft, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPatientChart } from "@/modules/clinical-records/application/records-service";
import { ChartTimeline } from "@/modules/clinical-records/presentation/components/chart-timeline";
import { RecordForm } from "@/modules/clinical-records/presentation/components/record-form";
import { requireRole } from "@/modules/identity/application/current-actor";
import { openConversationAction } from "@/modules/messaging/presentation/actions";
import { getPatientProfileForProfessional } from "@/modules/privacy/application/privacy-service";
import { AccessRequestForm } from "@/modules/privacy/presentation/components/access-request-form";
import { PatientViewCard } from "@/modules/privacy/presentation/components/patient-view-card";
import { listAppointmentsWithPatient } from "@/modules/scheduling/application/agenda-service";
import { STATUS_LABELS } from "@/modules/scheduling/domain/appointment-policy";
import { AppointmentStatusBadge, ModalityLabel } from "@/modules/scheduling/presentation/components/status-badge";
import { isDomainError } from "@/shared/errors";
import { formatDate, formatDateTime, formatTime } from "@/shared/lib/datetime";
import { Button } from "@/shared/ui/button";
import { Panel } from "@/shared/ui/layout";

export const metadata: Metadata = { title: "Ficha do paciente" };

export default async function PatientChartPage({ params }: PageProps<"/profissional/pacientes/[id]">) {
  const actor = await requireRole("PROFESSIONAL");
  const { id } = await params;

  let profile;
  try {
    profile = await getPatientProfileForProfessional(actor, id);
  } catch (error) {
    // Sem vínculo de cuidado (ou id inválido): não revela se o paciente existe.
    if (isDomainError(error)) notFound();
    throw error;
  }

  const [chart, history] = await Promise.all([getPatientChart(actor, id), listAppointmentsWithPatient(actor, id)]);
  const linkable = history.filter((item) => item.status !== "CANCELLED");
  const defaultAppointment = linkable.find((item) => item.hasStarted);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/profissional/pacientes" className="inline-flex items-center gap-1.5 text-sm font-semibold text-quaresmeira-700 hover:underline">
          <ArrowLeft className="size-4" aria-hidden />
          Pacientes
        </Link>
        <form action={openConversationAction}>
          <input type="hidden" name="counterpartId" value={id} />
          <Button type="submit" variant="secondary" size="sm">
            <MessageCircle className="size-4" aria-hidden />
            Enviar mensagem
          </Button>
        </form>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,25rem)_minmax(0,1fr)]">
        <div className="space-y-6">
          <PatientViewCard
            view={profile.view}
            subtitle={profile.policySource === "override" ? "Configuração que o paciente fez só para você" : "Configuração padrão do paciente"}
          />
          <AccessRequestForm
            patientId={id}
            requestableFields={profile.requestableFields}
            pendingRequest={profile.pendingRequest ? { ...profile.pendingRequest, createdAt: profile.pendingRequest.createdAt.toISOString() } : null}
          />
          <Panel title="Consultas com você">
            {history.length > 0 ? (
              <ul className="divide-y divide-linha">
                {history.map((item) => (
                  <li key={item.id} className="space-y-1.5 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">
                        {formatDate(item.startsAt)} às {formatTime(item.startsAt)}
                      </p>
                      <AppointmentStatusBadge status={item.status} />
                    </div>
                    <p className="flex flex-wrap items-center gap-x-3 text-sm text-pedra">
                      <span>{item.serviceName}</span>
                      <ModalityLabel modality={item.modality} />
                    </p>
                    {item.patientNote && <p className="rounded-xl bg-nevoa px-3 py-2 text-sm">Recado: {item.patientNote}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-pedra">Nenhuma consulta com você ainda.</p>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel
            title="Novo registro no prontuário"
            description="O paciente não vê o prontuário pelo app. Ele segue para os próximos profissionais conforme a visibilidade escolhida."
          >
            <RecordForm
              patientId={id}
              specialty={actor.specialty}
              patientDisplayName={profile.view.displayName}
              appointments={linkable.map((item) => ({
                id: item.id,
                label: `${formatDateTime(item.startsAt)}, ${item.serviceName} (${STATUS_LABELS[item.status].toLowerCase()})`,
              }))}
              defaultAppointmentId={defaultAppointment?.id}
            />
          </Panel>
          <Panel title="Prontuário" description="Registros de todos os profissionais que cuidaram deste paciente.">
            <ChartTimeline chart={chart} />
          </Panel>
        </div>
      </div>
    </>
  );
}
