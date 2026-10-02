import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/modules/identity/application/current-actor";
import { getOwnProfile } from "@/modules/identity/application/patient-profile-service";
import { ChangePasswordForm } from "@/modules/identity/presentation/components/change-password-form";
import { PatientProfileForm } from "@/modules/identity/presentation/components/patient-profile-form";
import { Callout } from "@/shared/ui/callout";
import { PageHeader, Panel } from "@/shared/ui/layout";

export const metadata: Metadata = { title: "Meus dados" };

export default async function PatientProfilePage() {
  const actor = await requireRole("PATIENT");
  const profile = await getOwnProfile(actor);

  return (
    <>
      <PageHeader title="Meus dados" description="Mantenha seus dados atualizados. Só você e a clínica veem tudo isto." />
      <Callout className="mb-6" title="Quem vê o quê é você que decide">
        <span className="inline-flex items-start gap-1.5">
          <ShieldCheck className="mt-0.5 hidden size-4 shrink-0 sm:block" aria-hidden />
          <span>
            Preencher um dado aqui não o mostra a ninguém. O que cada profissional vê é definido em{" "}
            <Link href="/paciente/privacidade">Privacidade</Link>.
          </span>
        </span>
      </Callout>
      <PatientProfileForm profile={profile} />
      <Panel className="mt-10" title="Senha de acesso" description="Ao trocar a senha, outras sessões abertas em outros aparelhos são encerradas.">
        <ChangePasswordForm />
      </Panel>
    </>
  );
}
