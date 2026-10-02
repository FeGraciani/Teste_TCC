"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PUBLIC_NAVIGATION } from "@/config/navigation";
import { cn } from "@/shared/lib/cn";
import { ButtonLink } from "./button";
import { Logo } from "./logo";

type Props = {
  /** Quando há sessão: link para a área da pessoa (ex.: /paciente). */
  areaHref?: string | null;
};

export function SiteHeader({ areaHref }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) => !href.includes("#") && (pathname === href || pathname.startsWith(`${href}/`));

  return (
    <header className="sticky top-0 z-40 border-b border-linha/70 bg-nevoa/90 backdrop-blur-md">
      <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Logo tagline />

        <nav aria-label="Navegação do site" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {PUBLIC_NAVIGATION.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "rounded-lg px-3 py-2 text-[0.95rem] font-semibold text-tinta transition-colors hover:bg-papel",
                    isActive(item.href) && "text-quaresmeira-700",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {areaHref ? (
            <ButtonLink href={areaHref}>Ir para minha área</ButtonLink>
          ) : (
            <>
              <ButtonLink href="/entrar" variant="quiet">
                Entrar
              </ButtonLink>
              <ButtonLink href="/cadastro">Agendar consulta</ButtonLink>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="menu-site"
          className="grid size-11 place-items-center rounded-xl text-tinta hover:bg-papel lg:hidden"
        >
          {open ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
          <span className="sr-only">{open ? "Fechar menu" : "Abrir menu"}</span>
        </button>
      </div>

      {open && (
        <div
          id="menu-site"
          className="fixed inset-x-0 top-[4.5rem] bottom-0 z-40 overflow-y-auto border-t border-linha bg-nevoa px-4 pt-4 pb-10 lg:hidden"
        >
          <nav aria-label="Navegação do site">
            <ul className="space-y-1">
              {PUBLIC_NAVIGATION.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-xl px-3 py-3 text-lg font-semibold text-tinta hover:bg-papel"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-6 grid gap-2 border-t border-linha pt-6">
            {areaHref ? (
              <ButtonLink href={areaHref} size="lg" onClick={() => setOpen(false)}>
                Ir para minha área
              </ButtonLink>
            ) : (
              <>
                <ButtonLink href="/cadastro" size="lg" onClick={() => setOpen(false)}>
                  Agendar consulta
                </ButtonLink>
                <ButtonLink href="/entrar" variant="secondary" size="lg" onClick={() => setOpen(false)}>
                  Entrar
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
