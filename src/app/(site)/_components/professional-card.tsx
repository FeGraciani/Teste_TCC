import { Monitor, MapPin } from "lucide-react";
import type { PublicProfessional } from "@/modules/identity/application/directory-service";
import { cn } from "@/shared/lib/cn";
import { Avatar, specialtyTone } from "@/shared/ui/avatar";
import { ButtonLink } from "@/shared/ui/button";

function monogramOf(name: string): string {
  const parts = name.replace(/^(Dra?\.)\s+/i, "").split(/\s+/);
  return (parts[0]!.charAt(0) + (parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : "")).toUpperCase();
}

function firstNameOf(displayName: string): string {
  const parts = displayName.split(/\s+/);
  return /^dra?\.$/i.test(parts[0] ?? "") ? `${parts[0]} ${parts[1] ?? ""}`.trim() : (parts[0] ?? displayName);
}

/** Apresentação de um profissional no site, com atalho para agendar. */
export function ProfessionalCard({ professional, showBio = true }: { professional: PublicProfessional; showBio?: boolean }) {
  return (
    <article className="flex h-full flex-col gap-4 rounded-[1.5rem] border border-linha bg-papel p-6">
      <div className="flex items-start gap-4">
        <Avatar monogram={monogramOf(professional.displayName)} tone={specialtyTone(professional.specialty)} size="lg" />
        <div className="min-w-0">
          <h3 className="text-lg font-bold">{professional.displayName}</h3>
          <p className="text-[0.95rem] text-pedra">{professional.title}</p>
          <p className="text-sm text-pedra">{professional.registry}</p>
        </div>
      </div>

      {showBio && professional.bio && <p className="text-[0.98rem]">{professional.bio}</p>}

      {professional.focusAreas.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Áreas de atuação">
          {professional.focusAreas.map((area) => (
            <li
              key={area}
              className={cn(
                "rounded-md px-2 py-0.5 text-[0.8rem] font-semibold",
                professional.specialty === "PSYCHIATRY" ? "bg-folha-50 text-folha-800" : "bg-quaresmeira-50 text-quaresmeira-800",
              )}
            >
              {area}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-pedra">
          {professional.acceptsOnline && (
            <span className="inline-flex items-center gap-1">
              <Monitor className="size-4" aria-hidden /> Online
            </span>
          )}
          {professional.acceptsInPerson && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-4" aria-hidden /> Presencial
            </span>
          )}
        </p>
        {professional.hasSchedule && (
          <ButtonLink href={`/paciente/agendar?profissional=${professional.id}`} variant="secondary" size="sm">
            Agendar com {firstNameOf(professional.displayName)}
          </ButtonLink>
        )}
      </div>
    </article>
  );
}
