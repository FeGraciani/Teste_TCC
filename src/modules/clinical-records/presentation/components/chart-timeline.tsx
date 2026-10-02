import { Pin, ShieldAlert } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { formatDateTime } from "@/shared/lib/datetime";
import { Avatar, specialtyTone } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import type { ChartEntry, PatientChart } from "../../application/records-service";
import { VISIBILITY_OPTIONS } from "../../domain/record-access";

const VISIBILITY_SHORT = {
  CARE_TEAM: "Equipe do paciente",
  SAME_SPECIALTY: "Mesma especialidade",
  AUTHOR_ONLY: "Só o autor",
} as const;

function monogramOf(name: string): string {
  const parts = name.replace(/^(Dra?\.)\s+/i, "").split(/\s+/);
  return ((parts[0]?.charAt(0) ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : "")).toUpperCase();
}

/** Prontuário em linha do tempo, com as notas de passagem de caso fixadas no topo. */
export function ChartTimeline({ chart }: { chart: PatientChart }) {
  const empty = chart.handoffs.length === 0 && chart.entries.length === 0;
  return (
    <div className="space-y-6">
      {chart.handoffs.length > 0 && (
        <section aria-labelledby="passagem" className="space-y-3">
          <h3 id="passagem" className="flex items-center gap-2 font-bold">
            <Pin className="size-4 text-ipe-800" aria-hidden />
            Notas para o próximo profissional
          </h3>
          {chart.handoffs.map((entry) => (
            <Entry key={entry.id} entry={entry} pinned />
          ))}
        </section>
      )}

      {chart.entries.length > 0 && (
        <section aria-labelledby="registros" className="space-y-3">
          <h3 id="registros" className="font-bold">
            Registros
          </h3>
          <ol className="relative space-y-3 border-l-2 border-linha pl-5">
            {chart.entries.map((entry) => (
              <li key={entry.id} className="relative">
                <span className="absolute top-5 -left-[1.6rem] size-3 rounded-full bg-quaresmeira-300 ring-4 ring-nevoa" aria-hidden />
                <Entry entry={entry} />
              </li>
            ))}
          </ol>
        </section>
      )}

      {empty && <p className="text-pedra">Ainda não há registros no prontuário deste paciente. A primeira anotação costuma ser a anamnese.</p>}

      {chart.restrictedCount > 0 && (
        <p className="flex gap-2 rounded-2xl bg-nevoa px-4 py-3 text-sm text-pedra">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {chart.restrictedCount === 1
            ? "1 registro de outro profissional tem acesso restrito e não aparece aqui."
            : `${chart.restrictedCount} registros de outros profissionais têm acesso restrito e não aparecem aqui.`}
        </p>
      )}
    </div>
  );
}

function Entry({ entry, pinned = false }: { entry: ChartEntry; pinned?: boolean }) {
  return (
    <article className={cn("space-y-3 rounded-[1.25rem] border p-4 sm:p-5", pinned ? "border-ipe-300 bg-ipe-50" : "border-linha bg-papel")}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Avatar monogram={monogramOf(entry.author.displayName)} tone={specialtyTone(entry.author.specialty)} size="sm" />
          <div>
            <p className="text-[0.95rem] font-semibold">
              {entry.author.isMe ? "Você" : entry.author.displayName}
              <span className="font-normal text-pedra">, {entry.author.title}</span>
            </p>
            <p className="text-sm text-pedra">{formatDateTime(entry.createdAt)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={pinned ? "yellow" : "violet"}>{entry.typeLabel}</Badge>
          <Badge tone="outline">
            <span title={VISIBILITY_OPTIONS[entry.visibility].hint}>{VISIBILITY_SHORT[entry.visibility]}</span>
          </Badge>
        </div>
      </header>
      <p className="text-[0.98rem] leading-relaxed break-words whitespace-pre-line">{entry.content}</p>
    </article>
  );
}
