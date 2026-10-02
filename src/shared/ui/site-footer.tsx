import Link from "next/link";
import { siteConfig } from "@/config/site";
import { CopyrightNotice } from "./copyright-notice";
import { CrisisNote } from "./crisis-note";
import { Logo } from "./logo";

const LINKS = {
  clinica: [
    { href: "/como-funciona", label: "Como funciona" },
    { href: "/valores", label: "Valores" },
    { href: "/equipe", label: "Equipe" },
    { href: "/cadastro", label: "Criar conta" },
  ],
  acesso: [
    { href: "/entrar", label: "Área do paciente" },
    { href: "/entrar?perfil=profissional", label: "Área do profissional" },
    { href: "/entrar?perfil=administracao", label: "Administração" },
  ],
  legal: [
    { href: "/politica-de-privacidade", label: "Política de privacidade" },
    { href: "/termos-de-uso", label: "Termos de uso" },
  ],
};

export function SiteFooter() {
  const { address, contact, technicalDirector } = siteConfig;
  return (
    <footer className="mt-auto border-t border-linha bg-papel">
      <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
        <CrisisNote />
      </div>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo tagline />
          <p className="max-w-xs text-[0.95rem] text-pedra">{siteConfig.tagline}</p>
          <address className="space-y-1 text-[0.95rem] not-italic text-pedra">
            <p>
              {address.street}, {address.district}
            </p>
            <p>
              {address.city}/{address.state}, CEP {address.zip}
            </p>
            <p>
              <a href={contact.phoneHref} className="font-semibold text-tinta hover:underline">
                {contact.phone}
              </a>{" "}
              ou{" "}
              <a href={`mailto:${contact.email}`} className="font-semibold text-tinta hover:underline">
                {contact.email}
              </a>
            </p>
          </address>
        </div>

        <FooterColumn title="A clínica" links={LINKS.clinica} />
        <FooterColumn title="Acessos" links={LINKS.acesso} />

        <div className="space-y-6">
          <FooterColumn title="Legal" links={LINKS.legal} />
          <div className="space-y-1 text-sm text-pedra">
            <p className="font-semibold text-tinta">Responsável técnica</p>
            <p>
              {technicalDirector.name}, {technicalDirector.registry}, {technicalDirector.rqe}
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-linha">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <CopyrightNotice />
          <p className="text-sm text-pedra">{siteConfig.openingHours.map((item) => `${item.days}, ${item.hours}`).join("; ")}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <nav aria-label={title} className="space-y-3">
      <p className="font-bold">{title}</p>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-[0.95rem] text-pedra hover:text-quaresmeira-700 hover:underline">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
