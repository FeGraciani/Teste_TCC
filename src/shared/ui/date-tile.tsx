import { cn } from "@/shared/lib/cn";
import { dateParts } from "@/shared/lib/datetime";

/** Bloquinho de calendário com dia da semana, dia e mês (no fuso da clínica). */
export function DateTile({ date, tone = "violet", className }: { date: Date | string; tone?: "violet" | "green" | "neutral"; className?: string }) {
  const parts = dateParts(date);
  return (
    <div
      className={cn(
        "flex w-16 shrink-0 flex-col items-center rounded-2xl py-2 leading-none",
        tone === "violet" && "bg-quaresmeira-50 text-quaresmeira-900",
        tone === "green" && "bg-folha-50 text-folha-800",
        tone === "neutral" && "bg-nevoa-escura text-pedra",
        className,
      )}
      aria-hidden
    >
      <span className="text-xs font-semibold">{parts.weekday}</span>
      <span className="my-1 text-[1.6rem] font-extrabold tracking-[-0.02em]">{parts.day}</span>
      <span className="text-xs font-semibold">{parts.month}</span>
    </div>
  );
}
