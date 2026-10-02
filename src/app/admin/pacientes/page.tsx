import { Search, Users } from "lucide-react";
import type { Metadata } from "next";
import { listPatientsForAdmin } from "@/modules/administration/application/administration-service";
import { AccountActions } from "@/modules/administration/presentation/components/account-actions";
import { requireRole } from "@/modules/identity/application/current-actor";
import { formatDate } from "@/shared/lib/datetime";
import { Badge } from "@/shared/ui/badge";
import { EmptyState, PageHeader } from "@/shared/ui/layout";

export const metadata: Metadata = { title: "Pacientes" };

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export default async function AdminPatientsPage({ searchParams }: PageProps<"/admin/pacientes">) {
  const actor = await requireRole("ADMIN");
  const params = await searchParams;
  const query = typeof params.busca === "string" ? params.busca.trim() : "";
  const patients = await listPatientsForAdmin(actor);
  const filtered = query ? patients.filter((patient) => normalize(`${patient.name} ${patient.email}`).includes(normalize(query))) : patients;

  return (
    <>
      <PageHeader
        title="Pacientes"
        description="Contas de pacientes, apenas com dados cadastrais. Informações de saúde e preferências de privacidade não aparecem aqui."
      />

      <form className="mb-6 flex max-w-md items-center gap-2" role="search">
        <label htmlFor="busca" className="sr-only">
          Buscar por nome ou e-mail
        </label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-pedra" aria-hidden />
          <input
            id="busca"
            name="busca"
            defaultValue={query}
            placeholder="Buscar por nome ou e-mail"
            className="h-11 w-full rounded-xl border border-linha-forte bg-papel pr-3 pl-9 text-[0.95rem] focus:border-quaresmeira-500 focus:ring-3 focus:ring-quaresmeira-100 focus:outline-none"
          />
        </div>
        <button type="submit" className="h-11 rounded-xl px-4 font-semibold text-quaresmeira-700 hover:bg-quaresmeira-50">
          Buscar
        </button>
      </form>

      {filtered.length > 0 ? (
        <ul className="space-y-3">
          {filtered.map((patient) => (
            <li key={patient.userId} className="rounded-[1.25rem] border border-linha bg-papel p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="flex flex-wrap items-center gap-2 font-bold">
                    {patient.name}
                    {!patient.active && <Badge tone="red">Acesso desativado</Badge>}
                  </p>
                  <p className="text-sm text-pedra">{patient.email}</p>
                </div>
                <p className="text-sm text-pedra">
                  Desde {formatDate(patient.createdAt)}
                  {patient.lastLoginAt ? `, último acesso em ${formatDate(patient.lastLoginAt)}` : ""}
                  {`, ${patient.appointments} ${patient.appointments === 1 ? "consulta" : "consultas"}`}
                </p>
              </div>
              <div className="mt-3 border-t border-linha pt-3">
                <AccountActions userId={patient.userId} active={patient.active} name={patient.name} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<Users className="size-5" aria-hidden />} title={query ? "Nenhuma conta encontrada" : "Nenhum paciente cadastrado ainda"}>
          {query ? "Tente outro nome ou e-mail." : "Os pacientes criam a própria conta pelo site."}
        </EmptyState>
      )}
    </>
  );
}
