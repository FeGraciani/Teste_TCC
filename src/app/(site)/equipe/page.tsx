import type { Metadata } from "next";
import { connection } from "next/server";
import { listPublicProfessionals } from "@/modules/identity/application/directory-service";
import { SPECIALTY_LABELS, type Specialty } from "@/modules/clinical-records/domain/record-access";
import { ProfessionalCard } from "../_components/professional-card";
import { PageIntro } from "../_components/section";

export const metadata: Metadata = {
  title: "Equipe",
  description: "Conheça as psicólogas, psicólogos e psiquiatras da Alento.",
};

export default async function TeamPage() {
  await connection();
  const professionals = await listPublicProfessionals();
  const specialties: Specialty[] = ["PSYCHOLOGY", "PSYCHIATRY"];

  return (
    <>
      <PageIntro title="Equipe">
        <p>
          Profissionais com registro ativo nos conselhos, que trabalham juntos pelo prontuário compartilhado e respeitam o que você decidiu mostrar.
        </p>
      </PageIntro>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-12 sm:px-6">
        {specialties.map((specialty) => {
          const group = professionals.filter((professional) => professional.specialty === specialty);
          if (group.length === 0) return null;
          return (
            <section key={specialty} aria-labelledby={`equipe-${specialty}`} className="space-y-5">
              <h2 id={`equipe-${specialty}`} className="text-[1.6rem] font-bold">
                {SPECIALTY_LABELS[specialty]}
              </h2>
              <div className="grid gap-5 md:grid-cols-2">
                {group.map((professional) => (
                  <ProfessionalCard key={professional.id} professional={professional} />
                ))}
              </div>
            </section>
          );
        })}
        {professionals.length === 0 && <p className="text-pedra">A equipe está sendo cadastrada. Volte em breve.</p>}
      </div>
    </>
  );
}
