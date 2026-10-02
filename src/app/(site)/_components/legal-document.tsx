import type { ReactNode } from "react";

/** Tipografia de documentos longos (política, termos): uma coluna de leitura confortável. */
export function LegalDocument({ title, updatedAt, children }: { title: string; updatedAt: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <header className="mb-10 space-y-3 border-b border-linha pb-8">
        <h1 className="text-[2.2rem] leading-[1.1] font-extrabold tracking-[-0.025em] sm:text-[2.7rem]">{title}</h1>
        <p className="text-pedra">Última atualização: {updatedAt}</p>
      </header>
      <div className="space-y-5 text-[1.04rem] leading-[1.7] [&_a]:font-semibold [&_a]:text-quaresmeira-700 [&_a]:underline [&_h2]:pt-6 [&_h2]:text-[1.35rem] [&_h2]:font-bold [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
        {children}
      </div>
    </article>
  );
}
