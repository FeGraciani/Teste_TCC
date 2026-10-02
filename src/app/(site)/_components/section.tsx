import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

/** Bloco de conteúdo do site com título e introdução alinhados à esquerda. */
export function Section({
  id,
  title,
  intro,
  children,
  className,
  tone = "plain",
}: {
  id?: string;
  title: ReactNode;
  intro?: ReactNode;
  children: ReactNode;
  className?: string;
  tone?: "plain" | "paper";
}) {
  const headingId = id ? `${id}-titulo` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={cn(tone === "paper" && "border-y border-linha bg-papel", className)}>
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mb-10 max-w-2xl space-y-3">
          <h2 id={headingId} className="text-[1.85rem] font-bold sm:text-[2.3rem]">
            {title}
          </h2>
          {intro && <div className="text-[1.08rem] text-pedra">{intro}</div>}
        </div>
        {children}
      </div>
    </section>
  );
}

/** Cabeçalho das páginas internas do site. */
export function PageIntro({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-14 pb-4 sm:px-6 sm:pt-20">
      <div className="max-w-3xl space-y-4">
        <h1 className="text-[2.2rem] leading-[1.1] font-extrabold tracking-[-0.025em] sm:text-[3rem]">{title}</h1>
        {children && <div className="text-[1.12rem] text-pedra">{children}</div>}
      </div>
    </div>
  );
}
