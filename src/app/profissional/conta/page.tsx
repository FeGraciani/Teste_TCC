import type { Metadata } from "next";
import { SPECIALTY_LABELS } from "@/modules/clinical-records/domain/record-access";
import { requireRole } from "@/modules/identity/application/current-actor";
import { getOwnProfessionalProfile } from "@/modules/identity/application/professional-profile-service";
import { ChangePasswordForm } from "@/modules/identity/presentation/components/change-password-form";
import { ProfessionalProfileForm } from "@/modules/identity/presentation/components/professional-profile-form";
import { PageHeader, Panel } from "@/shared/ui/layout";

export const metadata: Metadata = { title: "Minha conta" };

export default async function ProfessionalAccountPage() {
  const actor = await requireRole("PROFESSIONAL");
  const profile = await getOwnProfessionalProfile(actor);

  const facts = [
    ["Nome de exibição", profile.displayName],
    ["Título", profile.title],
    ["Especialidade", SPECIALTY_LABELS[profile.specialty]],
    ["Registro no conselho", profile.registry],
    ["E-mail de acesso", profile.email],
  ];

  return (
    <>
      <PageHeader title="Minha conta" description="Sua apresentação para os pacientes e a senha de acesso." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Panel title="Apresentação" description="Aparece na página da equipe e na escolha de profissional durante o agendamento.">
            <ProfessionalProfileForm bio={profile.bio} focusAreas={profile.focusAreas} />
          </Panel>
          <Panel title="Senha de acesso" description="Só você conhece a sua senha. Se esquecer, use “Esqueci minha senha” na tela de entrada.">
            <ChangePasswordForm />
          </Panel>
        </div>
        <Panel title="Dados cadastrais" description="Para alterar, fale com a administração da clínica." className="h-fit">
          <dl className="space-y-3">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm font-semibold text-pedra">{label}</dt>
                <dd className="font-semibold break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
    </>
  );
}
