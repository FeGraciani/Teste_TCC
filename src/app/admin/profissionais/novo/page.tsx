import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProfessionalForm } from "@/modules/administration/presentation/components/professional-form";
import { requireRole } from "@/modules/identity/application/current-actor";
import { PageHeader, Panel } from "@/shared/ui/layout";

export const metadata: Metadata = { title: "Cadastrar profissional" };

export default async function NewProfessionalPage() {
  await requireRole("ADMIN");
  return (
    <>
      <Link href="/admin/profissionais" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-quaresmeira-700 hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        Profissionais
      </Link>
      <PageHeader
        title="Cadastrar profissional"
        description="Crie o acesso de um psicólogo ou psiquiatra. Ele recebe um convite no e-mail para criar a própria senha (ninguém da clínica a conhece) e ajusta a própria agenda."
      />
      <Panel>
        <ProfessionalForm />
      </Panel>
    </>
  );
}
