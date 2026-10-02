import { CreditCard, ReceiptText, RotateCcw } from "lucide-react";
import { siteConfig } from "@/config/site";
import { PATIENT_CANCELLATION_MIN_HOURS } from "@/config/clinic";
import type { ServiceSummary } from "@/modules/catalog/application/catalog-service";
import { SPECIALTY_LABELS, type Specialty } from "@/modules/clinical-records/domain/record-access";
import { cn } from "@/shared/lib/cn";
import { formatBRL } from "@/shared/lib/money";

const SPECIALTY_NOTES: Record<Specialty, string> = {
  PSYCHOLOGY: "Psicoterapia com psicólogas e psicólogos registrados no CRP.",
  PSYCHIATRY: "Consultas médicas com psiquiatras registrados no CRM, com prescrição quando indicada.",
};

/** Tabela de valores por especialidade (dados vindos do cadastro de serviços). */
export function PriceList({ services, className }: { services: ServiceSummary[]; className?: string }) {
  const specialties: Specialty[] = ["PSYCHOLOGY", "PSYCHIATRY"];
  return (
    <div className={cn("grid gap-5 lg:grid-cols-2", className)}>
      {specialties.map((specialty) => {
        const items = services.filter((service) => service.specialty === specialty);
        if (items.length === 0) return null;
        return (
          <section
            key={specialty}
            aria-label={`Valores de ${SPECIALTY_LABELS[specialty]}`}
            className="rounded-[1.5rem] border border-linha bg-papel p-6 sm:p-7"
          >
            <div className="mb-4 flex items-baseline justify-between gap-3 border-b-2 border-tinta pb-3">
              <h3 className="text-xl font-bold">{SPECIALTY_LABELS[specialty]}</h3>
              <span
                className={cn("size-2.5 shrink-0 rounded-full", specialty === "PSYCHIATRY" ? "bg-folha-500" : "bg-quaresmeira-500")}
                aria-hidden
              />
            </div>
            <p className="mb-2 text-sm text-pedra">{SPECIALTY_NOTES[specialty]}</p>
            <ul className="divide-y divide-linha">
              {items.map((service) => (
                <li key={service.id} className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 py-4">
                  <p className="font-bold">{service.name}</p>
                  <p className="text-right text-lg font-bold whitespace-nowrap text-quaresmeira-800">{formatBRL(service.priceCents)}</p>
                  <p className="text-[0.95rem] text-pedra">{service.description}</p>
                  <p className="text-right text-sm whitespace-nowrap text-pedra">{service.durationMinutes} min</p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Formas de pagamento, reembolso e cancelamento. */
export function PaymentNotes() {
  const notes = [
    { icon: CreditCard, title: "Pagamento", text: `${siteConfig.payment.methods.join(" ou ")}, no dia da consulta.` },
    { icon: ReceiptText, title: "Reembolso", text: "Atendimento particular, com recibo para você pedir reembolso ao seu plano de saúde." },
    {
      icon: RotateCcw,
      title: "Cancelamento",
      text: `Sem custo até ${PATIENT_CANCELLATION_MIN_HOURS} horas antes, direto pelo app. Imprevisto em cima da hora? Avise pelo chat.`,
    },
  ];
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {notes.map((note) => (
        <li key={note.title} className="flex gap-3">
          <note.icon className="mt-0.5 size-5 shrink-0 text-quaresmeira-600" aria-hidden />
          <div>
            <p className="font-bold">{note.title}</p>
            <p className="text-[0.95rem] text-pedra">{note.text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
