import { CalendarCheck, HeartHandshake, RotateCcw } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { CLINIC_TIME_ZONE, PATIENT_CANCELLATION_MIN_HOURS } from "@/config/clinic";
import { listServices } from "@/modules/catalog/application/catalog-service";
import { listPublicProfessionals } from "@/modules/identity/application/directory-service";
import { PrivacyDemo } from "@/modules/privacy/presentation/components/privacy-demo";
import { todayKey } from "@/modules/scheduling/domain/availability";
import { formatBRL } from "@/shared/lib/money";
import { ButtonLink } from "@/shared/ui/button";
import { Faq } from "./_components/faq";
import { HowItWorks } from "./_components/how-it-works";
import { PaymentNotes, PriceList } from "./_components/price-list";
import { ProfessionalCard } from "./_components/professional-card";
import { Section } from "./_components/section";
import { WhoSeesWhat } from "./_components/who-sees-what";

export default async function HomePage() {
  await connection();
  const [services, professionals] = await Promise.all([listServices(), listPublicProfessionals()]);
  const psychologyPrices = services.filter((service) => service.specialty === "PSYCHOLOGY").map((service) => service.priceCents);
  const fromPrice = psychologyPrices.length ? Math.min(...psychologyPrices) : null;

  return (
    <>
      <section className="overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-12 pb-16 sm:px-6 lg:grid-cols-[1.08fr_1fr] lg:gap-16 lg:pt-20 lg:pb-24">
          <div className="space-y-7">
            <p className="text-[0.98rem] font-semibold text-quaresmeira-700">Psicologia e psiquiatria em São Paulo e online</p>
            <h1 className="text-[2.65rem] leading-[1.02] font-extrabold tracking-[-0.035em] sm:text-[3.5rem] lg:text-[4rem]">
              Conte o que precisa. Mostre só o que quiser.
            </h1>
            <p className="max-w-xl text-[1.15rem] text-pedra">
              Na Alento, você decide, dado por dado, o que cada psicólogo ou psiquiatra vê sobre você: do seu nome ao seu histórico de saúde. Agende
              em horários livres de verdade e converse com seu profissional pelo app.
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/cadastro" size="lg">
                Agendar primeira consulta
              </ButtonLink>
              <ButtonLink href="/como-funciona" variant="secondary" size="lg">
                Como funciona
              </ButtonLink>
            </div>
            <ul className="grid gap-3 pt-2 text-[0.98rem] sm:grid-cols-3 sm:gap-4">
              <li className="flex gap-2.5">
                <HeartHandshake className="mt-0.5 size-5 shrink-0 text-quaresmeira-600" aria-hidden />
                <span>{fromPrice !== null ? `Psicologia a partir de ${formatBRL(fromPrice)} por sessão` : "Sessão de acolhimento para começar"}</span>
              </li>
              <li className="flex gap-2.5">
                <CalendarCheck className="mt-0.5 size-5 shrink-0 text-quaresmeira-600" aria-hidden />
                <span>Horário confirmado na hora, sem esperar retorno</span>
              </li>
              <li className="flex gap-2.5">
                <RotateCcw className="mt-0.5 size-5 shrink-0 text-quaresmeira-600" aria-hidden />
                <span>Cancelamento sem custo até {PATIENT_CANCELLATION_MIN_HOURS}h antes</span>
              </li>
            </ul>
          </div>

          <div className="lg:pl-4">
            <PrivacyDemo today={todayKey(CLINIC_TIME_ZONE)} />
          </div>
        </div>
      </section>

      <Section
        id="como-funciona"
        title="Do primeiro clique à continuidade do cuidado"
        intro="Você não precisa ligar, esperar retorno nem repetir sua história a cada troca de profissional."
        tone="paper"
      >
        <HowItWorks />
        <p className="mt-10">
          <Link href="/como-funciona" className="font-semibold text-quaresmeira-700 underline-offset-4 hover:underline">
            Entenda cada etapa em detalhes
          </Link>
        </p>
      </Section>

      <Section
        id="privacidade"
        title="Quem vê o quê"
        intro="Anonimato aqui não é esconder informação do cuidado, e sim deixar você no controle de quem sabe o quê."
      >
        <WhoSeesWhat />
      </Section>

      <Section
        id="especialidades"
        title="Psicologia e psiquiatria no mesmo lugar"
        intro="Muitas vezes o melhor cuidado combina as duas. Aqui os profissionais conversam entre si pelo prontuário, sem você precisar recontar tudo."
        tone="paper"
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <Specialty
            title="Psicologia"
            tone="violet"
            text="Psicoterapia para entender o que você sente e encontrar novos jeitos de lidar com a vida. Sessões de 50 minutos, semanais ou quinzenais."
            topics={["Ansiedade e estresse", "Tristeza e desânimo", "Luto e perdas", "Relacionamentos", "Autoestima", "Mudanças e decisões"]}
          />
          <Specialty
            title="Psiquiatria"
            tone="green"
            text="Avaliação médica, diagnóstico e, quando indicado, tratamento com medicamentos, com consultas de acompanhamento ao longo do tratamento."
            topics={["Depressão", "Transtornos de ansiedade", "TDAH em adultos", "Insônia", "Transtorno bipolar", "Ajuste de medicação"]}
          />
        </div>
        <div className="mt-5 flex flex-col gap-4 rounded-[1.5rem] bg-ipe-50 p-6 ring-1 ring-ipe-300 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl space-y-1">
            <p className="text-lg font-bold">Não sabe por onde começar?</p>
            <p className="text-pedra">
              Agende uma sessão de acolhimento. Uma psicóloga ouve você com calma e indica o melhor caminho: terapia, psiquiatria ou os dois.
            </p>
          </div>
          <ButtonLink href="/cadastro" variant="secondary">
            Agendar acolhimento
          </ButtonLink>
        </div>
      </Section>

      <Section id="valores" title="Valores" intro="Preços claros, definidos antes de você agendar. O valor fica registrado na sua consulta.">
        <PriceList services={services} />
        <div className="mt-10">
          <PaymentNotes />
        </div>
      </Section>

      {professionals.length > 0 && (
        <Section
          id="equipe"
          title="Quem cuida de você"
          intro="Psicólogas, psicólogos e psiquiatras com registro ativo nos conselhos profissionais."
          tone="paper"
        >
          <div className="grid gap-5 md:grid-cols-2">
            {professionals.slice(0, 4).map((professional) => (
              <ProfessionalCard key={professional.id} professional={professional} showBio={false} />
            ))}
          </div>
          <p className="mt-8">
            <Link href="/equipe" className="font-semibold text-quaresmeira-700 underline-offset-4 hover:underline">
              Conhecer toda a equipe
            </Link>
          </p>
        </Section>
      )}

      <Section id="duvidas" title="Perguntas frequentes">
        <Faq />
      </Section>

      <section className="px-4 pb-20 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 rounded-[2rem] bg-quaresmeira-900 px-6 py-12 text-white sm:px-12 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <h2 className="text-[1.9rem] font-bold sm:text-[2.3rem]">Quando você estiver pronto, a gente está aqui.</h2>
            <p className="text-[1.08rem] text-quaresmeira-100">
              Crie sua conta, escolha como quer aparecer e marque um horário livre. Leva poucos minutos.
            </p>
          </div>
          <ButtonLink href="/cadastro" size="lg" className="bg-white text-quaresmeira-900 hover:bg-quaresmeira-50 active:bg-quaresmeira-100">
            Criar conta e agendar
          </ButtonLink>
        </div>
      </section>
    </>
  );
}

function Specialty({ title, text, topics, tone }: { title: string; text: string; topics: string[]; tone: "violet" | "green" }) {
  return (
    <div className="flex flex-col gap-4 rounded-[1.5rem] border border-linha bg-nevoa p-6 sm:p-7">
      <div className="flex items-center gap-3">
        <span className={tone === "green" ? "size-3 rounded-full bg-folha-500" : "size-3 rounded-full bg-quaresmeira-500"} aria-hidden />
        <h3 className="text-xl font-bold">{title}</h3>
      </div>
      <p className="text-[1.02rem]">{text}</p>
      <ul className="flex flex-wrap gap-2" aria-label={`Temas atendidos em ${title}`}>
        {topics.map((topic) => (
          <li
            key={topic}
            className={
              tone === "green"
                ? "rounded-lg bg-folha-50 px-2.5 py-1 text-sm font-semibold text-folha-800"
                : "rounded-lg bg-quaresmeira-50 px-2.5 py-1 text-sm font-semibold text-quaresmeira-800"
            }
          >
            {topic}
          </li>
        ))}
      </ul>
    </div>
  );
}
