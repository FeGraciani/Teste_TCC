import type { Metadata } from "next";
import { AUDIT_ACTIONS, listAuditLog, type AuditAction } from "@/modules/audit/application/audit-service";
import { requireRole } from "@/modules/identity/application/current-actor";
import { ROLE_LABELS, type Role } from "@/modules/identity/domain/roles";
import { formatDate, formatTime } from "@/shared/lib/datetime";
import { Badge } from "@/shared/ui/badge";
import { EmptyState, PageHeader } from "@/shared/ui/layout";

export const metadata: Metadata = { title: "Auditoria" };

const ACTION_KEYS = Object.keys(AUDIT_ACTIONS) as AuditAction[];

export default async function AuditPage({ searchParams }: PageProps<"/admin/auditoria">) {
  const actor = await requireRole("ADMIN");
  const params = await searchParams;
  const action = typeof params.acao === "string" && params.acao in AUDIT_ACTIONS ? (params.acao as AuditAction) : undefined;
  const entries = await listAuditLog(actor, { action, limit: 300 });

  return (
    <>
      <PageHeader title="Auditoria" description="Quem fez o quê e quando (LGPD, art. 37). Só metadados: nenhum conteúdo clínico é registrado aqui." />

      <form className="mb-6 flex flex-wrap items-center gap-2">
        <label htmlFor="acao" className="text-sm font-semibold">
          Filtrar por ação
        </label>
        <select id="acao" name="acao" defaultValue={action ?? ""} className="h-10 rounded-lg border border-linha-forte bg-papel px-2 text-sm">
          <option value="">Todas</option>
          {ACTION_KEYS.map((key) => (
            <option key={key} value={key}>
              {AUDIT_ACTIONS[key]}
            </option>
          ))}
        </select>
        <button type="submit" className="h-10 rounded-lg px-3 text-sm font-semibold text-quaresmeira-700 hover:bg-quaresmeira-50">
          Aplicar
        </button>
      </form>

      {entries.length > 0 ? (
        <div className="overflow-x-auto rounded-[1.25rem] border border-linha bg-papel">
          <table className="w-full min-w-[46rem] text-left text-[0.95rem]">
            <caption className="sr-only">Eventos registrados, do mais recente para o mais antigo</caption>
            <thead className="bg-nevoa text-sm">
              <tr>
                <th scope="col" className="px-4 py-3 font-bold">
                  Quando
                </th>
                <th scope="col" className="px-4 py-3 font-bold">
                  Quem
                </th>
                <th scope="col" className="px-4 py-3 font-bold">
                  Ação
                </th>
                <th scope="col" className="px-4 py-3 font-bold">
                  Objeto
                </th>
                <th scope="col" className="px-4 py-3 font-bold">
                  IP
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linha">
              {entries.map((entry) => (
                <tr key={entry.id} className="align-top">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatDate(entry.createdAt)}
                    <span className="block text-sm text-pedra">{formatTime(entry.createdAt)}</span>
                  </td>
                  <td className="px-4 py-3">
                    {entry.actorName ?? <span className="text-pedra">Não identificado</span>}
                    {entry.actorRole && <span className="block text-sm text-pedra">{ROLE_LABELS[entry.actorRole as Role] ?? entry.actorRole}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={
                        entry.action === "CLINICAL_RECORDS_VIEWED" || entry.action === "PATIENT_PROFILE_VIEWED"
                          ? "violet"
                          : entry.action === "AUTH_LOGIN_FAILED"
                            ? "red"
                            : "neutral"
                      }
                    >
                      {entry.actionLabel}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-pedra">{entry.entityType ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-pedra">{entry.ipAddress ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="Nenhum evento encontrado" />
      )}
    </>
  );
}
