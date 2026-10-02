import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfessionalForAdmin } from "@/modules/administration/application/administration-service";
import { AccountActions } from "@/modules/administration/presentation/components/account-actions";
import { ProfessionalForm } from "@/modules/administration/presentation/components/professional-form";
import { requireRole } from "@/modules/identity/application/current-actor";
import { PageHeader, Panel } from "@/shared/ui/layout";

export const metadata: Metadata = { title: "Editar profissional" };

export default async function EditProfessionalPage({ params }: PageProps<"/admin/profissionais/[id]">) {
  const actor = await requireRole("ADMIN");
  const { id } = await params;
  const professional = await getProfessionalForAdmin(actor, id);
  if (!professional) notFound();

  return (
    <>
      <Link href="/admin/profissionais" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-quaresmeira-700 hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        Profissionais
      </Link>
      <PageHeader title={professional.displayName} description="Dados cadastrais exibidos no site e usados no agendamento." />
      <div className="space-y-6">
        <Panel>
          <ProfessionalForm professional={professional} />
        </Panel>
        <Panel
          title="Acesso"
          description={
            professional.pendingInvite
              ? "O convite ainda não foi aceito: o profissional ainda não criou a senha. Reenvie o convite se ele não encontrou o e-mail."
              : "Se o profissional esqueceu a senha, envie um link para o e-mail dele: só ele cria a nova senha. Desative o acesso quando ele deixar a clínica."
          }
        >
          <AccountActions
            userId={professional.userId}
            active={professional.active}
            name={professional.displayName}
            pendingInvite={professional.pendingInvite}
            upcomingAppointments={professional.upcomingAppointments}
          />
        </Panel>
      </div>
    </>
  );
}
