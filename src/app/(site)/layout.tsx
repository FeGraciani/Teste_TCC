import type { ReactNode } from "react";
import { getCurrentActor } from "@/modules/identity/application/current-actor";
import { ROLE_HOME } from "@/modules/identity/domain/roles";
import { SiteFooter } from "@/shared/ui/site-footer";
import { SiteHeader } from "@/shared/ui/site-header";

/** Site institucional: cabeçalho, conteúdo e rodapé (com direitos reservados). */
export default async function SiteLayout({ children }: { children: ReactNode }) {
  const actor = await getCurrentActor();
  return (
    <>
      <SiteHeader areaHref={actor ? ROLE_HOME[actor.role] : null} />
      <main id="conteudo" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
