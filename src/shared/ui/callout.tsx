import { CircleCheck, Info, TriangleAlert, CircleX } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

type Tone = "info" | "success" | "warning" | "danger";

const tones: Record<Tone, { box: string; icon: typeof Info }> = {
  info: { box: "bg-quaresmeira-50 text-quaresmeira-900 ring-quaresmeira-200", icon: Info },
  success: { box: "bg-folha-50 text-folha-800 ring-folha-200", icon: CircleCheck },
  warning: { box: "bg-ipe-50 text-ipe-800 ring-ipe-300", icon: TriangleAlert },
  danger: { box: "bg-urucum-50 text-urucum-700 ring-urucum-100", icon: CircleX },
};

export function Callout({
  tone = "info",
  title,
  children,
  className,
  role,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  role?: "status" | "alert";
}) {
  const { box, icon: Icon } = tones[tone];
  return (
    <div className={cn("flex gap-3 rounded-2xl px-4 py-3.5 ring-1 ring-inset", box, className)} role={role}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-1 text-[0.95rem]">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed [&_a]:font-semibold [&_a]:underline">{children}</div>}
      </div>
    </div>
  );
}
