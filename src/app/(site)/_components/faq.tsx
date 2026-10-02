import { ChevronDown } from "lucide-react";
import { ONLINE_ROOM_OPENS_MINUTES_BEFORE, PATIENT_CANCELLATION_MIN_HOURS } from "@/config/clinic";
import { siteConfig } from "@/config/site";

const QUESTIONS = [
  {
    question: "O profissional vai saber meu nome?",
    answer:
      "Só se você quiser. Você escolhe entre nome completo, primeiro nome, iniciais ou um codinome, e pode fazer uma escolha diferente para cada profissional. A clínica guarda o seu cadastro completo apenas para a parte administrativa, como agenda e recibos.",
  },
  {
    question: "E se o profissional precisar de um dado que eu ocultei?",
    answer:
      "Ele pede pelo app e explica o motivo, por exemplo o CPF para uma receita de controle especial. Você recebe o pedido e decide se aprova. A liberação vale só para os dados pedidos e só para aquele profissional, e você pode revogá-la quando quiser.",
  },
  {
    question: "Posso ver o meu prontuário?",
    answer: `O prontuário é o registro técnico feito pelos profissionais e não aparece no app do paciente: ele existe para que quem cuidar de você depois continue o seu tratamento. Você tem direito a uma cópia sempre que quiser, como garantem a LGPD e os conselhos de medicina e psicologia. Basta pedir à clínica pelo e-mail ${siteConfig.contact.email}.`,
  },
  {
    question: "Como funciona a consulta online?",
    answer: `${ONLINE_ROOM_OPENS_MINUTES_BEFORE} minutos antes do horário, o botão “Entrar na sala” aparece na sua área do paciente. Você só precisa de um celular ou computador com câmera e de um lugar reservado.`,
  },
  {
    question: "Posso cancelar ou remarcar?",
    answer: `Você cancela pelo app, sem custo, até ${PATIENT_CANCELLATION_MIN_HOURS} horas antes e escolhe outro horário livre. Se o profissional tiver um imprevisto, ele cancela informando o motivo e você recebe o aviso na hora, pelo chat.`,
  },
  {
    question: "Vocês atendem plano de saúde?",
    answer: "Os atendimentos são particulares. Emitimos recibo com os dados necessários para você pedir reembolso ao seu plano.",
  },
  {
    question: "E se eu estiver em crise agora?",
    answer: "Não espere pela consulta. Ligue 188 (CVV, gratuito, 24 horas) ou 192 (SAMU). Em perigo imediato, procure o pronto-socorro mais próximo.",
  },
];

export function Faq() {
  return (
    <div className="divide-y divide-linha overflow-hidden rounded-[1.5rem] border border-linha bg-papel">
      {QUESTIONS.map((item) => (
        <details key={item.question} className="group">
          <summary className="flex items-center justify-between gap-4 px-5 py-4 text-[1.05rem] font-bold hover:bg-nevoa sm:px-6">
            {item.question}
            <ChevronDown className="size-5 shrink-0 text-quaresmeira-600 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <p className="max-w-3xl px-5 pb-5 text-pedra sm:px-6">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
