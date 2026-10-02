import { cn } from "@/shared/lib/cn";

type Tone = "violet" | "green" | "neutral" | "mist" | "yellow";

const tones: Record<Tone, string> = {
  violet: "bg-quaresmeira-100 text-quaresmeira-800",
  green: "bg-folha-100 text-folha-800",
  neutral: "bg-nevoa-escura text-tinta",
  mist: "bg-gradient-to-br from-quaresmeira-100 via-nevoa to-folha-100 text-quaresmeira-800 ring-1 ring-inset ring-quaresmeira-200",
  yellow: "bg-ipe-100 text-ipe-800",
};

const sizes = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-lg",
};

/** Monograma (nunca foto): mantém a discrição e não depende de upload de imagem. */
export function Avatar({
  monogram,
  tone = "neutral",
  size = "md",
  className,
  label,
}: {
  monogram: string;
  tone?: Tone;
  size?: keyof typeof sizes;
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center rounded-full font-bold tracking-wide", tones[tone], sizes[size], className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    >
      {monogram.slice(0, 2)}
    </span>
  );
}

export function specialtyTone(specialty: "PSYCHOLOGY" | "PSYCHIATRY"): Tone {
  return specialty === "PSYCHIATRY" ? "green" : "violet";
}
