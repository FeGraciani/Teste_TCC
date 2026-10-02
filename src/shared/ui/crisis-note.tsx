import { LifeBuoy } from "lucide-react";
import { siteConfig } from "@/config/site";
import { cn } from "@/shared/lib/cn";

/** Contatos de crise. Sempre visível onde a pessoa pode estar sozinha (chat, rodapé). */
export function CrisisNote({ className, compact = false }: { className?: string; compact?: boolean }) {
  const [cvv, samu] = siteConfig.crisisLines;
  if (compact) {
    return (
      <p className={cn("flex items-start gap-2 text-sm text-pedra", className)}>
        <LifeBuoy className="mt-0.5 size-4 shrink-0 text-urucum-600" aria-hidden />
        <span>
          Em crise ou pensando em se machucar? Ligue{" "}
          <a href="tel:188" className="font-semibold text-tinta underline">
            188
          </a>{" "}
          (CVV, 24h) ou{" "}
          <a href="tel:192" className="font-semibold text-tinta underline">
            192
          </a>{" "}
          (SAMU). Este canal não é para emergências.
        </span>
      </p>
    );
  }
  return (
    <div className={cn("flex gap-3 rounded-2xl bg-urucum-50 px-4 py-3.5 text-urucum-700 ring-1 ring-inset ring-urucum-100", className)}>
      <LifeBuoy className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="text-[0.95rem] leading-relaxed">
        <p className="font-semibold">Se você está em crise agora, não espere pela consulta.</p>
        <p>
          Ligue{" "}
          <a href={`tel:${cvv.phone}`} className="font-bold underline">
            {cvv.phone}
          </a>{" "}
          ({cvv.name.split(" — ")[0]}, gratuito e 24h) ou{" "}
          <a href={`tel:${samu.phone}`} className="font-bold underline">
            {samu.phone}
          </a>{" "}
          ({samu.name}). Em perigo imediato, procure o pronto-socorro mais próximo.
        </p>
      </div>
    </div>
  );
}
