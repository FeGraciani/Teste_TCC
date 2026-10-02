import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

type Tone = "neutral" | "violet" | "green" | "yellow" | "red" | "outline";

const tones: Record<Tone, string> = {
  neutral: "bg-nevoa-escura text-pedra",
  violet: "bg-quaresmeira-100 text-quaresmeira-800",
  green: "bg-folha-100 text-folha-800",
  yellow: "bg-ipe-100 text-ipe-800",
  red: "bg-urucum-100 text-urucum-700",
  outline: "ring-1 ring-inset ring-linha-forte text-pedra",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[0.8rem] font-semibold leading-5", tones[tone], className)}>
      {children}
    </span>
  );
}
