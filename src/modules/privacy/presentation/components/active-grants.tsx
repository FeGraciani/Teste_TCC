"use client";

import { KeyRound, X } from "lucide-react";
import { useActionState } from "react";
import { INITIAL_ACTION_STATE } from "@/shared/lib/action-state";
import { formatDate } from "@/shared/lib/datetime";
import { FormMessage } from "@/shared/ui/form-message";
import { SubmitButton } from "@/shared/ui/submit-button";
import { revokeGrantAction } from "../actions";

type Grant = {
  professionalId: string;
  professionalName: string;
  professionalTitle: string;
  fields: { key: string; label: string; grantedAt: string }[];
};

/**
 * Dados liberados por pedido aprovado. Cada liberação vale só para aquele
 * profissional, por cima das preferências, até o paciente revogar aqui.
 */
export function ActiveGrants({ grants }: { grants: Grant[] }) {
  const [state, formAction] = useActionState(revokeGrantAction, INITIAL_ACTION_STATE);

  return (
    <section aria-labelledby="liberacoes" className="mb-8 space-y-3">
      <div>
        <h2 id="liberacoes" className="text-xl font-bold">
          Dados liberados por pedido
        </h2>
        <p className="text-[0.95rem] text-pedra">
          Valem só para quem pediu, por cima das preferências abaixo, até você revogar. O profissional é avisado pelo chat quando você revoga.
        </p>
      </div>
      <FormMessage state={state} />
      <ul className="space-y-3">
        {grants.map((grant) => (
          <li key={grant.professionalId} className="rounded-[1.25rem] border border-linha bg-papel p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-quaresmeira-50 text-quaresmeira-700">
                  <KeyRound className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="font-bold">
                    {grant.professionalName} <span className="font-normal text-pedra">({grant.professionalTitle})</span>
                  </p>
                  <p className="text-sm text-pedra">Também vê os dados abaixo, liberados por você.</p>
                </div>
              </div>
              {grant.fields.length > 1 && (
                <form action={formAction}>
                  <input type="hidden" name="professionalId" value={grant.professionalId} />
                  <SubmitButton variant="danger-quiet" size="sm" pendingLabel="Revogando…">
                    Revogar todas
                  </SubmitButton>
                </form>
              )}
            </div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {grant.fields.map((field) => (
                <li key={field.key}>
                  <form
                    action={formAction}
                    className="inline-flex items-center gap-1 rounded-xl bg-quaresmeira-50 py-1 pr-1 pl-3 ring-1 ring-inset ring-quaresmeira-200"
                  >
                    <input type="hidden" name="professionalId" value={grant.professionalId} />
                    <input type="hidden" name="field" value={field.key} />
                    <span className="text-sm font-semibold text-quaresmeira-900">{field.label}</span>
                    <span className="text-xs text-pedra">desde {formatDate(field.grantedAt)}</span>
                    <SubmitButton
                      variant="quiet"
                      size="sm"
                      className="h-7 px-1.5"
                      pendingLabel="…"
                      aria-label={`Revogar ${field.label} para ${grant.professionalName}`}
                    >
                      <X className="size-4" aria-hidden />
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
