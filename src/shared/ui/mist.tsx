import { Lock } from "lucide-react";
import { cn } from "@/shared/lib/cn";

/**
 * Valor oculto pelo paciente, desenhado como "névoa".
 * O texto borrado é FICTÍCIO: o dado real nunca é enviado ao navegador.
 * Rótulo e névoa ocupam a mesma célula de grade, então o rótulo nunca quebra.
 */
const PLACEHOLDERS = ["Informação reservada pelo paciente", "Dado protegido pela escolha do paciente", "Conteúdo reservado pelo paciente"];

export function Mist({ label = "Oculto pelo paciente", seed = 0, className }: { label?: string; seed?: number; className?: string }) {
  return (
    <span className={cn("inline-grid max-w-full items-center overflow-hidden align-middle", className)}>
      <span aria-hidden className="nevoa col-start-1 row-start-1 truncate pl-6 text-tinta">
        {PLACEHOLDERS[seed % PLACEHOLDERS.length]}
      </span>
      <span className="col-start-1 row-start-1 inline-flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap text-quaresmeira-700">
        <Lock className="size-3.5 shrink-0" aria-hidden />
        {label}
      </span>
    </span>
  );
}
