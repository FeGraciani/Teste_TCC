import { ChevronRight, Search, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/modules/identity/application/current-actor";
import { presetLabel } from "@/modules/privacy/domain/privacy-fields";
import { listProfessionalPatients } from "@/modules/scheduling/application/agenda-service";
import { formatDate, formatTime, relativeDayLabel } from "@/shared/lib/datetime";
import { Avatar } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { EmptyState, PageHeader } from "@/shared/ui/layout";

export const metadata: Metadata = { title: "Pacientes" };

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export default async function ProfessionalPatientsPage({ searchParams }: PageProps<"/profissional/pacientes">) {
  const actor = await requireRole("PROFESSIONAL");
  const params = await searchParams;
  const query = typeof params.busca === "string" ? params.busca.trim() : "";
  const patients = await listProfessionalPatients(actor);
  // A busca acontece sobre o nome JÁ anonimizado: procurar por um nome
  // oculto não revela que ele existe.
  const filtered = query ? patients.filter((patient) => normalize(patient.displayName).includes(normalize(query))) : patients;

  return (
    <>
      <PageHeader
        title="Pacientes"
        description="Quem tem consulta marcada ou realizada com você. Cada pessoa aparece com o nome que escolheu mostrar."
      />

      <form className="mb-6 flex max-w-md items-center gap-2" role="search">
        <label htmlFor="busca" className="sr-only">
          Buscar paciente
        </label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-pedra" aria-hidden />
          <input
            id="busca"
            name="busca"
            defaultValue={query}
            placeholder="Buscar pelo nome exibido ou codinome"
            className="h-11 w-full rounded-xl border border-linha-forte bg-papel pr-3 pl-9 text-[0.95rem] focus:border-quaresmeira-500 focus:ring-3 focus:ring-quaresmeira-100 focus:outline-none"
          />
        </div>
        <button type="submit" className="h-11 rounded-xl px-4 font-semibold text-quaresmeira-700 hover:bg-quaresmeira-50">
          Buscar
        </button>
      </form>

      {filtered.length > 0 ? (
        <ul className="divide-y divide-linha overflow-hidden rounded-[1.25rem] border border-linha bg-papel">
          {filtered.map((patient) => (
            <li key={patient.patientId}>
              <Link href={`/profissional/pacientes/${patient.patientId}`} className="flex items-center gap-4 px-4 py-4 hover:bg-nevoa sm:px-5">
                <Avatar monogram={patient.monogram} tone={patient.preset === "ANONYMOUS" ? "mist" : "violet"} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-bold">{patient.displayName}</p>
                    <Badge tone={patient.preset === "ANONYMOUS" ? "violet" : "outline"}>Modo {presetLabel(patient.preset).toLowerCase()}</Badge>
                  </div>
                  <p className="text-sm text-pedra">
                    {patient.nextAppointment
                      ? `Próxima consulta: ${relativeDayLabel(patient.nextAppointment).toLowerCase()}, ${formatTime(patient.nextAppointment)}`
                      : patient.lastAppointment
                        ? `Última consulta em ${formatDate(patient.lastAppointment)}`
                        : "Sem consultas futuras"}
                    {`. ${patient.totalAppointments} ${patient.totalAppointments === 1 ? "atendimento" : "atendimentos"} com você.`}
                  </p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-quaresmeira-600" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<Users className="size-5" aria-hidden />} title={query ? "Nenhum paciente encontrado" : "Nenhum paciente ainda"}>
          {query ? "A busca considera só o nome que cada paciente escolheu mostrar." : "Quando alguém agendar com você, a ficha aparece aqui."}
        </EmptyState>
      )}
    </>
  );
}
