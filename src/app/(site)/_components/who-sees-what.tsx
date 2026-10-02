import { Building2, Check, Stethoscope, UserRound, X } from "lucide-react";
import type { ReactNode } from "react";
import { siteConfig } from "@/config/site";

const ACTORS = [
  {
    icon: UserRound,
    title: "Você",
    tone: "bg-ipe-100 text-ipe-800",
    sees: ["Todos os seus dados, para editar quando quiser", "Suas consultas e mensagens", "Quem acessou seu perfil, e quando"],
    doesNotSee: [],
    decides: ["O que cada profissional pode ver", "Aprovar ou recusar pedidos de acesso a dados ocultos"],
  },
  {
    icon: Stethoscope,
    title: "Seu psicólogo ou psiquiatra",
    tone: "bg-quaresmeira-100 text-quaresmeira-800",
    sees: ["Só os dados que você liberou para ele", "O prontuário escrito pelos colegas que cuidaram de você"],
    doesNotSee: ["O que você ocultou", "Pacientes que não atende"],
    decides: [],
  },
  {
    icon: Building2,
    title: "A administração da clínica",
    tone: "bg-folha-100 text-folha-800",
    sees: ["Seu cadastro (nome e e-mail), para agenda e recibos", "Datas e valores das consultas"],
    doesNotSee: ["Prontuários", "Suas informações de saúde", "As mensagens do chat"],
    decides: [],
  },
];

/** Quem vê o quê: a promessa de privacidade explicada sem jargão. */
export function WhoSeesWhat() {
  return (
    <div className="space-y-10">
      <div className="grid gap-5 lg:grid-cols-3">
        {ACTORS.map((actor) => (
          <div key={actor.title} className="flex flex-col gap-5 rounded-[1.5rem] border border-linha bg-papel p-6">
            <div className="flex items-center gap-3">
              <span className={`grid size-11 place-items-center rounded-xl ${actor.tone}`}>
                <actor.icon className="size-5" aria-hidden />
              </span>
              <h3 className="text-lg font-bold">{actor.title}</h3>
            </div>
            <List title="Vê" items={actor.sees} positive />
            {actor.decides.length > 0 && <List title="Decide" items={actor.decides} positive />}
            {actor.doesNotSee.length > 0 && <List title="Não vê" items={actor.doesNotSee} />}
          </div>
        ))}
      </div>

      <div className="grid gap-6 rounded-[1.5rem] bg-quaresmeira-900 p-6 text-white sm:p-8 md:grid-cols-3">
        <Fact title="Criptografia em repouso">
          Prontuários, dados de saúde e mensagens ficam criptografados no banco (AES-256). Sem a chave, são ilegíveis.
        </Fact>
        <Fact title="Registro de cada acesso">
          Toda vez que um profissional abre seu perfil ou seu prontuário, fica registrado — e você vê isso na sua área.
        </Fact>
        <Fact title="Prontuário protegido por lei">
          Ele não aparece no app do paciente, mas você pode pedir uma cópia à clínica quando quiser ({siteConfig.contact.email}).
        </Fact>
      </div>
    </div>
  );
}

function List({ title, items, positive = false }: { title: string; items: string[]; positive?: boolean }) {
  const Icon = positive ? Check : X;
  return (
    <div className="space-y-2">
      <p className="text-sm font-bold text-pedra">{title}</p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-[0.98rem]">
            <Icon className={positive ? "mt-1 size-4 shrink-0 text-folha-600" : "mt-1 size-4 shrink-0 text-urucum-600"} aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Fact({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="font-bold">{title}</p>
      <p className="text-[0.95rem] text-quaresmeira-100">{children}</p>
    </div>
  );
}
