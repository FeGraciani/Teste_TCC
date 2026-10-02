import Link from "next/link";
import { cn } from "@/shared/lib/cn";

/** Marca: um anel com uma abertura — o respiro — e o ponto amarelo do ipê. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <circle
        cx="16"
        cy="16.5"
        r="10.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeDasharray="50 16"
        transform="rotate(-38 16 16.5)"
      />
      <circle cx="25.2" cy="7.6" r="3.4" fill="var(--color-ipe-400)" />
    </svg>
  );
}

export function Logo({
  href = "/",
  className,
  tagline = false,
  tone = "dark",
}: {
  href?: string;
  className?: string;
  tagline?: boolean;
  tone?: "dark" | "light";
}) {
  return (
    <Link
      href={href}
      className={cn("group inline-flex items-center gap-2.5", tone === "dark" ? "text-quaresmeira-700" : "text-white", className)}
      aria-label="Alento — página inicial"
    >
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className={cn("text-[1.45rem] font-bold tracking-[-0.03em]", tone === "dark" ? "text-tinta" : "text-white")}>alento</span>
        {tagline && (
          <span className={cn("mt-1 text-[0.72rem] font-medium", tone === "dark" ? "text-pedra" : "text-quaresmeira-100")}>
            psicologia &amp; psiquiatria
          </span>
        )}
      </span>
    </Link>
  );
}
