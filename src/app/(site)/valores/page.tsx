import type { Metadata } from "next";
import { connection } from "next/server";
import { listServices } from "@/modules/catalog/application/catalog-service";
import { ButtonLink } from "@/shared/ui/button";
import { PaymentNotes, PriceList } from "../_components/price-list";
import { PageIntro, Section } from "../_components/section";

export const metadata: Metadata = {
  title: "Valores",
  description: "Valores das consultas de psicologia e psiquiatria da Alento, formas de pagamento, reembolso e política de cancelamento.",
};

const INCLUDED = [
  ["Chat com o seu profissional", "Para combinar detalhes e avisar imprevistos, sem precisar de WhatsApp pessoal."],
  ["Privacidade sob o seu controle", "Você escolhe o que cada profissional vê, sem custo adicional."],
  ["Continuidade do cuidado", "O prontuário acompanha você se precisar de outro profissional da clínica."],
  ["Recibo para reembolso", "Com os dados que os planos de saúde costumam pedir."],
];

export default async function PricesPage() {
  await connection();
  const services = await listServices();
  return (
    <>
      <PageIntro title="Valores">
        <p>Preços claros, definidos antes de você agendar. O valor fica registrado na sua consulta e não muda depois de marcado.</p>
      </PageIntro>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        {services.length > 0 ? (
          <PriceList services={services} />
        ) : (
          <p className="text-pedra">Os valores estão sendo atualizados. Fale com a clínica para saber mais.</p>
        )}
        <div className="mt-12">
          <PaymentNotes />
        </div>
      </div>

      <Section id="incluido" title="Em toda consulta" tone="paper">
        <ul className="grid gap-5 md:grid-cols-2">
          {INCLUDED.map(([title, text]) => (
            <li key={title} className="space-y-1">
              <p className="font-bold">{title}</p>
              <p className="text-pedra">{text}</p>
            </li>
          ))}
        </ul>
        <div className="mt-10">
          <ButtonLink href="/cadastro" size="lg">
            Criar conta e agendar
          </ButtonLink>
        </div>
      </Section>
    </>
  );
}
