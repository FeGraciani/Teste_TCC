import { copyrightLine, siteConfig } from "@/config/site";
import { cn } from "@/shared/lib/cn";

/** Aviso de direitos reservados — presente em todas as páginas do site e do app. */
export function CopyrightNotice({ className }: { className?: string }) {
  return (
    <p className={cn("text-sm text-pedra", className)}>
      {copyrightLine()} <span className="whitespace-nowrap">CNPJ {siteConfig.cnpj}.</span>
    </p>
  );
}
