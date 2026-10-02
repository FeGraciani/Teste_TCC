import type { Metadata } from "next";
import { ButtonLink } from "@/shared/ui/button";
import { CopyrightNotice } from "@/shared/ui/copyright-notice";
import { Logo } from "@/shared/ui/logo";

export const metadata: Metadata = { title: "Página não encontrada" };

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col px-4 py-6 sm:px-8">
      <Logo tagline />
      <main id="conteudo" className="flex flex-1 items-center">
        <div className="mx-auto max-w-lg space-y-5 py-16">
          <p className="text-[4rem] leading-none font-extrabold text-quaresmeira-200" aria-hidden>
            404
          </p>
          <h1 className="text-[2rem] font-bold">Não encontramos esta página</h1>
          <p className="text-pedra">
            O endereço pode ter mudado, ou o conteúdo não está disponível para o seu perfil. Volte para o início ou entre na sua área.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/">Ir para o início</ButtonLink>
            <ButtonLink href="/entrar" variant="secondary">
              Entrar
            </ButtonLink>
          </div>
        </div>
      </main>
      <footer className="border-t border-linha pt-5">
        <CopyrightNotice />
      </footer>
    </div>
  );
}
