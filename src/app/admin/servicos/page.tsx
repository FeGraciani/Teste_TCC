import { ChevronDown, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ServiceForm } from "@/modules/administration/presentation/components/service-form";
import { listServices } from "@/modules/catalog/application/catalog-service";
import { SPECIALTY_LABELS } from "@/modules/clinical-records/domain/record-access";
import { requireRole } from "@/modules/identity/application/current-actor";
import { formatBRL } from "@/shared/lib/money";
import { Badge } from "@/shared/ui/badge";
import { PageHeader, Panel } from "@/shared/ui/layout";

export const metadata: Metadata = { title: "Serviços e valores" };

export default async function AdminServicesPage() {
  await requireRole("ADMIN");
  const services = await listServices({ includeInactive: true });

  return (
    <>
      <PageHeader
        title="Serviços e valores"
        description={
          <>
            Os serviços ativos aparecem na página{" "}
            <Link href="/valores" className="font-semibold text-quaresmeira-700 underline">
              Valores
            </Link>{" "}
            e no agendamento. Mudanças de preço valem só para novos agendamentos.
          </>
        }
      />

      <div className="space-y-3">
        {services.map((service) => (
          <details key={service.id} className="group rounded-[1.25rem] border border-linha bg-papel">
            <summary className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-bold">
                  {service.name}
                  <Badge tone={service.specialty === "PSYCHIATRY" ? "green" : "violet"}>{SPECIALTY_LABELS[service.specialty]}</Badge>
                  {!service.active && <Badge tone="red">Inativo</Badge>}
                </p>
                <p className="text-sm text-pedra">
                  {service.durationMinutes} min, {formatBRL(service.priceCents)}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-quaresmeira-700">
                Editar
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
              </span>
            </summary>
            <div className="border-t border-linha p-4 sm:p-5">
              <ServiceForm service={service} />
            </div>
          </details>
        ))}
      </div>

      <Panel className="mt-8" title="Novo serviço" description="Ex.: avaliação psicológica, terapia de casal, retorno psiquiátrico.">
        <details className="group">
          <summary className="inline-flex items-center gap-1.5 font-semibold text-quaresmeira-700">
            <Plus className="size-4" aria-hidden />
            Adicionar serviço
          </summary>
          <div className="mt-5">
            <ServiceForm />
          </div>
        </details>
      </Panel>
    </>
  );
}
