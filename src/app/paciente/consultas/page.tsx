import { CalendarPlus } from "lucide-react";
import type { Metadata } from "next";
import { requireRole } from "@/modules/identity/application/current-actor";
import { listPatientAppointments } from "@/modules/scheduling/application/agenda-service";
import { PatientAppointmentCard } from "@/modules/scheduling/presentation/components/patient-appointment-card";
import { ButtonLink } from "@/shared/ui/button";
import { Callout } from "@/shared/ui/callout";
import { EmptyState, PageHeader } from "@/shared/ui/layout";

export const metadata: Metadata = { title: "Minhas consultas" };

export default async function PatientAppointmentsPage({ searchParams }: PageProps<"/paciente/consultas">) {
  const actor = await requireRole("PATIENT");
  const params = await searchParams;
  const justBooked = typeof params.agendada === "string" ? params.agendada : null;
  const { upcoming, past } = await listPatientAppointments(actor);
  const booked = justBooked ? upcoming.find((appointment) => appointment.id === justBooked) : undefined;

  return (
    <>
      <PageHeader
        title="Minhas consultas"
        description="Acompanhe seus horários, entre na sala online e avise o profissional pelo chat se surgir um imprevisto."
        actions={
          <ButtonLink href="/paciente/agendar">
            <CalendarPlus className="size-4" aria-hidden />
            Agendar consulta
          </ButtonLink>
        }
      />

      {booked && (
        <Callout tone="success" className="mb-6" role="status" title="Consulta agendada!">
          O horário está reservado para você e o profissional já recebeu o aviso pelo chat. Se precisar, você pode cancelar sem custo até 24h antes.
        </Callout>
      )}

      <section aria-labelledby="proximas" className="space-y-4">
        <h2 id="proximas" className="text-xl font-bold">
          Próximas
        </h2>
        {upcoming.length > 0 ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {upcoming.map((appointment) => (
              <PatientAppointmentCard key={appointment.id} appointment={appointment} highlight={appointment.id === justBooked} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<CalendarPlus className="size-5" aria-hidden />}
            title="Você não tem consultas marcadas"
            action={<ButtonLink href="/paciente/agendar">Escolher um horário</ButtonLink>}
          >
            Quando agendar, a consulta aparece aqui com o botão para entrar na sala online.
          </EmptyState>
        )}
      </section>

      {past.length > 0 && (
        <section aria-labelledby="anteriores" className="mt-12 space-y-4">
          <h2 id="anteriores" className="text-xl font-bold">
            Anteriores e canceladas
          </h2>
          <div className="grid gap-3 xl:grid-cols-2">
            {past.map((appointment) => (
              <PatientAppointmentCard key={appointment.id} appointment={appointment} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
