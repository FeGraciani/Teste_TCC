import type { Metadata } from "next";
import { ONLINE_ROOM_OPENS_MINUTES_BEFORE, PATIENT_CANCELLATION_MIN_HOURS } from "@/config/clinic";
import {
  NAMED_PRESET_KEYS,
  PRIVACY_FIELDS,
  PRIVACY_FIELD_GROUPS,
  PRIVACY_FIELD_KEYS,
  PRIVACY_PRESETS,
} from "@/modules/privacy/domain/privacy-fields";
import { ButtonLink } from "@/shared/ui/button";
import { Faq } from "../_components/faq";
import { PageIntro, Section } from "../_components/section";

export const metadata: Metadata = {
  title: "Como funciona",
  description: "Do cadastro à consulta: como agendar, como funciona o anonimato configurável e como o prontuário garante a continuidade do cuidado.",
};

const STAGES = [
  {
    title: "Antes da consulta",
    steps: [
      {
        title: "Crie sua conta",
        text: "Com nome, e-mail e data de nascimento. Já no cadastro você escolhe como quer aparecer para os profissionais: identificado, discreto ou anônimo.",
      },
      {
        title: "Ajuste sua privacidade",
        text: "Em “Privacidade”, defina o nível de cada dado e, se quiser, crie exceções para um profissional específico. Uma prévia mostra exatamente o que ele vai ver.",
      },
      {
        title: "Agende num horário livre",
        text: "Escolha o tipo de atendimento, o profissional e um dos horários disponíveis. A agenda só mostra o que está livre de verdade, e o horário fica reservado assim que você confirma.",
      },
    ],
  },
  {
    title: "No dia",
    steps: [
      {
        title: "Online ou presencial",
        text: `Na consulta online, o botão “Entrar na sala” aparece ${ONLINE_ROOM_OPENS_MINUTES_BEFORE} minutos antes. Na presencial, é só vir ao consultório na Vila Madalena.`,
      },
      {
        title: "Imprevistos têm canal próprio",
        text: `Você e o profissional conversam pelo chat do app. Se ele precisar cancelar, informa o motivo e você é avisado na hora, pelo app e por um e-mail discreto. Você cancela sem custo até ${PATIENT_CANCELLATION_MIN_HOURS}h antes.`,
      },
    ],
  },
  {
    title: "Depois",
    steps: [
      {
        title: "O cuidado continua",
        text: "O profissional registra a consulta no prontuário. Esse registro não aparece no app do paciente: ele fica disponível para os próximos profissionais da clínica que atenderem você, sempre com a identidade que você autorizou.",
      },
      {
        title: "Transparência sobre acessos",
        text: "Na sua área, você vê quem abriu seu perfil ou seu prontuário, e quando. E pode pedir à clínica uma cópia do seu prontuário sempre que quiser.",
      },
    ],
  },
];

/** Numeração contínua entre as etapas (é uma sequência única). */
const NUMBERED_STAGES = STAGES.map((stage, stageIndex) => {
  const offset = STAGES.slice(0, stageIndex).reduce((total, previous) => total + previous.steps.length, 0);
  return { ...stage, steps: stage.steps.map((step, index) => ({ ...step, number: offset + index + 1 })) };
});

export default function HowItWorksPage() {
  return (
    <>
      <PageIntro title="Como funciona">
        <p>
          Um atendimento pensado para você chegar com calma: agenda transparente, conversa direta com o profissional e controle total sobre o que cada
          um sabe a seu respeito.
        </p>
      </PageIntro>

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-12 sm:px-6">
        {NUMBERED_STAGES.map((stage, stageIndex) => (
          <section key={stage.title} aria-labelledby={`etapa-${stageIndex}`} className="grid gap-6 lg:grid-cols-[14rem_1fr]">
            <h2 id={`etapa-${stageIndex}`} className="text-xl font-bold text-quaresmeira-800 lg:pt-1">
              {stage.title}
            </h2>
            <ol className="space-y-4" start={stage.steps[0]?.number}>
              {stage.steps.map((step) => (
                <li key={step.title} className="flex gap-4 rounded-[1.25rem] border border-linha bg-papel p-5 sm:p-6">
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-quaresmeira-100 font-bold text-quaresmeira-800"
                    aria-hidden
                  >
                    {step.number}
                  </span>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold">{step.title}</h3>
                    <p className="text-pedra">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      <Section
        id="controle"
        title="O que você controla, dado por dado"
        intro="Cada informação do seu cadastro tem níveis de exibição. O profissional só recebe o nível que você escolheu: os dados ocultos nem chegam à tela dele."
        tone="paper"
      >
        <div className="space-y-8">
          <div className="grid gap-4 md:grid-cols-3">
            {NAMED_PRESET_KEYS.map((key) => (
              <div key={key} className="rounded-[1.25rem] bg-nevoa p-5">
                <p className="font-bold">Modo {PRIVACY_PRESETS[key].label.toLowerCase()}</p>
                <p className="text-[0.95rem] text-pedra">{PRIVACY_PRESETS[key].summary}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-[1.25rem] border border-linha">
            <table className="w-full min-w-[40rem] text-left">
              <caption className="sr-only">Dados controlados pelo paciente e níveis de exibição</caption>
              <thead className="bg-nevoa text-sm">
                <tr>
                  <th scope="col" className="px-5 py-3 font-bold">
                    Dado
                  </th>
                  <th scope="col" className="px-5 py-3 font-bold">
                    Opções, da mais aberta à mais reservada
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linha">
                {PRIVACY_FIELD_GROUPS.map((group) =>
                  PRIVACY_FIELD_KEYS.filter((key) => PRIVACY_FIELDS[key].group === group.key).map((key) => {
                    const field = PRIVACY_FIELDS[key];
                    return (
                      <tr key={key} className="align-top">
                        <th scope="row" className="px-5 py-3.5 font-semibold">
                          {field.label}
                          <span className="block text-sm font-normal text-pedra">{group.label}</span>
                        </th>
                        <td className="px-5 py-3.5">
                          <ul className="flex flex-wrap gap-1.5">
                            {field.options.map((option) => (
                              <li key={option.value} className="rounded-md bg-quaresmeira-50 px-2 py-0.5 text-sm font-semibold text-quaresmeira-800">
                                {option.label}
                              </li>
                            ))}
                          </ul>
                          {"safetyNote" in field && <p className="mt-2 text-sm text-pedra">{field.safetyNote}</p>}
                        </td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <Section
        id="profissionais"
        title="E do lado dos profissionais"
        intro="As mesmas ferramentas que protegem você deixam o trabalho do profissional mais organizado."
      >
        <ul className="grid gap-5 md:grid-cols-2">
          {[
            [
              "Agenda e horários de trabalho",
              "Cada profissional define seus períodos de atendimento e de trabalho interno, o intervalo entre sessões e a antecedência mínima.",
            ],
            [
              "Ausências com aviso automático",
              "Ao bloquear um período por imprevisto, as consultas afetadas podem ser canceladas de uma vez, com aviso a cada paciente pelo chat.",
            ],
            [
              "Prontuário com quem precisa ver",
              "Cada registro pode ser lido pela equipe que cuida do paciente, só pela mesma especialidade ou só pelo autor.",
            ],
            [
              "Pedidos de acesso",
              "Precisa de um dado oculto, como o CPF para uma receita? O profissional pede, explica o motivo e o paciente decide.",
            ],
          ].map(([title, text]) => (
            <li key={title} className="space-y-1 rounded-[1.25rem] border border-linha bg-papel p-5">
              <p className="font-bold">{title}</p>
              <p className="text-pedra">{text}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="duvidas" title="Perguntas frequentes" tone="paper">
        <Faq />
        <div className="mt-10 flex flex-wrap gap-3">
          <ButtonLink href="/cadastro" size="lg">
            Criar conta e agendar
          </ButtonLink>
          <ButtonLink href="/valores" variant="secondary" size="lg">
            Ver valores
          </ButtonLink>
        </div>
      </Section>
    </>
  );
}
