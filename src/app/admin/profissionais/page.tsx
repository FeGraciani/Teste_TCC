import { Pencil, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { listProfessionalsForAdmin } from "@/modules/administration/application/administration-service";
import { AccountActions } from "@/modules/administration/presentation/components/account-actions";
import { SPECIALTY_LABELS } from "@/modules/clinical-records/domain/record-access";
import { requireRole } from "@/modules/identity/application/current-actor";
import { Avatar, specialtyTone } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { ButtonLink } from "@/shared/ui/button";
import { EmptyState, PageHeader } from "@/shared/ui/layout";
import { monogramFromName } from "../../_components/account-block";

export const metadata: Metadata = { title: "Profissionais" };

export default async function AdminProfessionalsPage() {
  const actor = await requireRole("ADMIN");
  const professionals = await listProfessionalsForAdmin(actor);

  return (
    <>
      <PageHeader
        title="Profissionais"
        description="Cadastre psicólogos e psiquiatras, ajuste dados e controle o acesso de cada um."
        actions={
          <ButtonLink href="/admin/profissionais/novo">
            <UserPlus className="size-4" aria-hidden />
            Cadastrar profissional
          </ButtonLink>
        }
      />

      {professionals.length > 0 ? (
        <ul className="space-y-3">
          {professionals.map((professional) => (
            <li key={professional.professionalId} className="rounded-[1.25rem] border border-linha bg-papel p-4 sm:p-5">
              <div className="flex flex-wrap items-start gap-4">
                <Avatar monogram={monogramFromName(professional.displayName)} tone={specialtyTone(professional.specialty)} size="lg" />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{professional.displayName}</p>
                    <Badge tone={professional.specialty === "PSYCHIATRY" ? "green" : "violet"}>{SPECIALTY_LABELS[professional.specialty]}</Badge>
                    {!professional.active && <Badge tone="red">Acesso desativado</Badge>}
                    {professional.active && professional.pendingInvite && <Badge tone="yellow">Convite pendente</Badge>}
                  </div>
                  <p className="text-sm text-pedra">
                    {professional.title}, {professional.registry}
                  </p>
                  <p className="text-sm text-pedra">{professional.email}</p>
                  <p className="text-sm">
                    {professional.weeklyBlocks === 0 ? (
                      <span className="font-semibold text-urucum-700">Sem horários de trabalho cadastrados</span>
                    ) : (
                      `${professional.weeklyBlocks} períodos semanais`
                    )}
                    {`, ${professional.upcomingAppointments} ${professional.upcomingAppointments === 1 ? "consulta futura" : "consultas futuras"}`}
                  </p>
                </div>
                <Link
                  href={`/admin/profissionais/${professional.professionalId}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-quaresmeira-700 hover:bg-quaresmeira-50"
                >
                  <Pencil className="size-4" aria-hidden />
                  Editar
                </Link>
              </div>
              <div className="mt-3 border-t border-linha pt-3">
                <AccountActions
                  userId={professional.userId}
                  active={professional.active}
                  name={professional.displayName}
                  pendingInvite={professional.pendingInvite}
                  upcomingAppointments={professional.upcomingAppointments}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Nenhum profissional cadastrado" action={<ButtonLink href="/admin/profissionais/novo">Cadastrar o primeiro</ButtonLink>}>
          Os pacientes só conseguem agendar depois que houver profissionais com horários de atendimento.
        </EmptyState>
      )}
    </>
  );
}
