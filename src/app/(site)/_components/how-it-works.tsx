const STEPS = [
  {
    title: "Crie sua conta e escolha como aparecer",
    text: "Identificado, discreto ou anônimo. Depois você ajusta campo por campo e pode abrir exceções para um profissional específico.",
  },
  {
    title: "Escolha o profissional e um horário livre",
    text: "A agenda mostra só os horários realmente disponíveis de cada psicólogo e psiquiatra. Nada de esperar confirmação.",
  },
  {
    title: "Converse pelo app e faça a consulta",
    text: "Presencial ou online. Se surgir um imprevisto, você e o profissional se avisam pelo chat, e o aviso de cancelamento chega na hora, também por e-mail.",
  },
  {
    title: "Seu cuidado continua, mesmo com outro profissional",
    text: "O prontuário segue para o próximo profissional que atender você, sempre com a identidade que você autorizou.",
  },
];

/** Os quatro passos do atendimento (é uma sequência, por isso a numeração). */
export function HowItWorks() {
  return (
    <ol className="grid gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-4">
      {STEPS.map((step, index) => (
        <li key={step.title} className="relative space-y-3 lg:pt-2">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-quaresmeira-700 text-lg font-bold text-white" aria-hidden>
              {index + 1}
            </span>
            {index < STEPS.length - 1 && <span className="hidden h-px flex-1 bg-quaresmeira-200 lg:block" aria-hidden />}
          </div>
          <h3 className="text-lg font-bold">{step.title}</h3>
          <p className="text-pedra">{step.text}</p>
        </li>
      ))}
    </ol>
  );
}
