import Link from "next/link";
import type { ReactNode } from "react";
import type { NavItem } from "@/config/navigation";
import { MobileMenu, NavLinks } from "./app-navigation";
import { CopyrightNotice } from "./copyright-notice";
import { CountersProvider, type NavCounters } from "./counters-provider";
import { Logo } from "./logo";

type Props = {
  homeHref: string;
  areaLabel: string;
  items: NavItem[];
  counters: NavCounters;
  /** Bloco da conta (nome, perfil, botão Sair), montado pela área. */
  account: ReactNode;
  children: ReactNode;
};

/** Estrutura das áreas logadas: menu lateral no computador, menu suspenso no celular. */
export function AppShell({ homeHref, areaLabel, items, counters, account, children }: Props) {
  return (
    <CountersProvider initial={counters}>
      {/* O fundo branco e a linha do menu lateral acompanham páginas longas (o menu em si fica fixo). */}
      <div className="min-h-dvh lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:bg-[linear-gradient(to_right,var(--color-papel)_calc(16.5rem-1px),var(--color-linha)_calc(16.5rem-1px),var(--color-linha)_16.5rem,transparent_16.5rem)]">
        <aside className="sticky top-0 hidden h-dvh flex-col gap-7 overflow-y-auto border-r border-linha bg-papel px-4 py-6 lg:flex">
          <div className="space-y-1.5 px-2">
            <Logo href={homeHref} />
            <p className="text-sm font-semibold text-pedra">{areaLabel}</p>
          </div>
          <nav aria-label="Menu principal">
            <NavLinks items={items} />
          </nav>
          <div className="mt-auto border-t border-linha pt-5">{account}</div>
        </aside>

        <div className="flex min-h-dvh min-w-0 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-linha bg-papel/95 px-4 backdrop-blur lg:hidden">
            <div className="flex items-center gap-3">
              <Logo href={homeHref} />
              <span className="hidden text-sm font-semibold text-pedra sm:inline">{areaLabel}</span>
            </div>
            <MobileMenu items={items} footer={account} />
          </header>

          <main id="conteudo" className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>

          <footer className="border-t border-linha px-4 py-5 sm:px-6 lg:px-10">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CopyrightNotice />
              <p className="flex gap-4 text-sm">
                <Link href="/politica-de-privacidade" className="text-pedra hover:text-quaresmeira-700 hover:underline">
                  Política de privacidade
                </Link>
                <Link href="/termos-de-uso" className="text-pedra hover:text-quaresmeira-700 hover:underline">
                  Termos de uso
                </Link>
              </p>
            </div>
          </footer>
        </div>
      </div>
    </CountersProvider>
  );
}
