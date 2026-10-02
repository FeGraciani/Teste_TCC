import { EyeOff } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { Avatar } from "@/shared/ui/avatar";
import { Mist } from "@/shared/ui/mist";
import { PRIVACY_FIELD_GROUPS, presetLabel, type PrivacyFieldKey } from "../../domain/privacy-fields";
import type { ProfessionalPatientView, ProjectedValue } from "../../domain/projection";

type Props = {
  view: ProfessionalPatientView;
  /** Mostra só alguns campos (ex.: demonstração do site). */
  onlyKeys?: readonly PrivacyFieldKey[];
  /** Linha abaixo do nome (ex.: "Como a Dra. Helena vê você"). */
  subtitle?: ReactNode;
  /** Conteúdo extra no topo à direita. */
  aside?: ReactNode;
  className?: string;
  /** Anima a troca de valores (névoa entrando e saindo). */
  animated?: boolean;
};

/**
 * Ficha do paciente do ponto de vista do profissional.
 * Recebe a PROJEÇÃO já filtrada: dados ocultos chegam aqui sem conteúdo.
 */
export function PatientViewCard({ view, onlyKeys, subtitle, aside, className, animated = false }: Props) {
  const fields = onlyKeys ? view.fields.filter((field) => onlyKeys.includes(field.key)) : view.fields;
  const groups = PRIVACY_FIELD_GROUPS.map((group) => ({ ...group, fields: fields.filter((field) => field.group === group.key) })).filter(
    (group) => group.fields.length > 0,
  );
  const reserved = view.nameLevel === "PSEUDONYM" || view.nameLevel === "INITIALS";
  // Conta só os campos exibidos (a demonstração do site mostra um subconjunto).
  const hiddenCount = fields.filter((field) => field.value.status === "hidden").length;

  return (
    <article className={cn("overflow-hidden rounded-[1.5rem] border border-linha bg-papel shadow-flutuante", className)}>
      <header className="flex items-start gap-3.5 border-b border-linha px-5 py-4 sm:px-6">
        <Avatar monogram={view.monogram} tone={reserved ? "mist" : "violet"} size="lg" />
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-xl font-bold", animated && "transicao-nevoa")} key={animated ? view.displayName : undefined}>
            {view.displayName}
          </p>
          {subtitle && <p className="text-sm text-pedra">{subtitle}</p>}
          <p className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center rounded-md bg-quaresmeira-100 px-2 py-0.5 text-[0.8rem] font-semibold text-quaresmeira-800">
              Modo {presetLabel(view.preset).toLowerCase()}
            </span>
            {hiddenCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-nevoa-escura px-2 py-0.5 text-[0.8rem] font-semibold text-pedra">
                <EyeOff className="size-3.5" aria-hidden />
                {hiddenCount} {hiddenCount === 1 ? "dado oculto" : "dados ocultos"}
              </span>
            )}
          </p>
        </div>
        {aside}
      </header>

      <div className="divide-y divide-linha">
        {groups.map((group) => (
          <section key={group.key} className="px-5 py-4 sm:px-6" aria-label={group.label}>
            <h3 className="mb-2.5 text-sm font-bold text-pedra">{group.label}</h3>
            <dl className="space-y-3">
              {group.fields.map((field, index) => (
                <div key={field.key} className="grid gap-1 sm:grid-cols-[11rem_1fr] sm:gap-4">
                  <dt className="text-sm font-semibold text-pedra">{field.label}</dt>
                  <dd className="min-w-0 text-[0.98rem]">
                    <ProjectedValueView value={field.value} seed={index} animated={animated} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </article>
  );
}

function ProjectedValueView({ value, seed, animated }: { value: ProjectedValue; seed: number; animated: boolean }) {
  switch (value.status) {
    case "hidden":
      return <Mist seed={seed} className={animated ? "animate-surgir" : undefined} />;
    case "empty":
      return <span className="text-pedra">Não informado</span>;
    case "partial":
      return (
        <span className={cn("block", animated && "animate-surgir")} key={animated ? value.text : undefined}>
          <span className="font-semibold break-words">{value.text}</span>
          <span className="mt-0.5 block text-sm text-quaresmeira-700">{value.detail}</span>
        </span>
      );
    case "shown":
      return (
        <span className={cn("block", animated && "animate-surgir")} key={animated ? value.text : undefined}>
          <span className="font-semibold break-words whitespace-pre-line">{value.text}</span>
          {value.detail && <span className="mt-0.5 block text-sm text-pedra">{value.detail}</span>}
        </span>
      );
  }
}
