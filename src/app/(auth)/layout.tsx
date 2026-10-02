import Link from "next/link";
import type { ReactNode } from "react";
import { CopyrightNotice } from "@/shared/ui/copyright-notice";
import { CrisisNote } from "@/shared/ui/crisis-note";
import { Logo } from "@/shared/ui/logo";

/** Telas de entrada e cadastro: painel da marca à esquerda (desktop) e formulário à direita. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,36rem)]">
      <aside className="relative hidden overflow-hidden bg-quaresmeira-900 px-12 py-10 text-white lg:flex lg:flex-col">
        <Logo tone="light" tagline />
        <div className="my-auto max-w-md space-y-8">
          <p className="text-[2.1rem] leading-[1.15] font-bold tracking-[-0.02em]">O que você conta fica com quem você escolher.</p>
          <IdentityLadder />
          <p className="text-[1.02rem] text-quaresmeira-100">
            Você decide, dado por dado, o que cada psicólogo ou psiquiatra vê. O prontuário segue para o próximo profissional que cuidar de você,
            sempre com a identidade que você autorizou.
          </p>
        </div>
        <p className="text-sm text-quaresmeira-200">
          Em crise? Ligue{" "}
          <a href="tel:188" className="font-bold text-white underline">
            188
          </a>{" "}
          (CVV, 24h) ou{" "}
          <a href="tel:192" className="font-bold text-white underline">
            192
          </a>{" "}
          (SAMU).
        </p>
      </aside>

      <div className="flex min-h-dvh flex-col bg-nevoa px-4 py-6 sm:px-8">
        <div className="lg:hidden">
          <Logo tagline />
        </div>
        <main id="conteudo" className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">{children}</div>
        </main>
        <footer className="space-y-3 border-t border-linha pt-5">
          <CrisisNote compact className="lg:hidden" />
          <CopyrightNotice />
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Link href="/" className="text-pedra hover:text-quaresmeira-700 hover:underline">
              Voltar ao site
            </Link>
            <Link href="/politica-de-privacidade" className="text-pedra hover:text-quaresmeira-700 hover:underline">
              Política de privacidade
            </Link>
            <Link href="/termos-de-uso" className="text-pedra hover:text-quaresmeira-700 hover:underline">
              Termos de uso
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}

/** Os níveis de identificação do nome, do mais aberto ao mais reservado. */
function IdentityLadder() {
  const steps = [
    { text: "Mariana Souza de Oliveira", note: "Identificado" },
    { text: "Mari", note: "Discreto" },
    { text: "Jacarandá-27", note: "Anônimo" },
  ];
  return (
    <ol className="space-y-2.5" aria-label="Exemplo de como o nome pode aparecer para o profissional">
      {steps.map((step, index) => (
        <li
          key={step.note}
          className="flex items-center justify-between gap-4 rounded-2xl bg-white/8 px-4 py-3 ring-1 ring-white/15"
          style={{ marginLeft: `${index * 1.25}rem` }}
        >
          <span className="text-lg font-semibold">{step.text}</span>
          <span className="rounded-md bg-white/12 px-2 py-0.5 text-sm text-quaresmeira-100">{step.note}</span>
        </li>
      ))}
    </ol>
  );
}
