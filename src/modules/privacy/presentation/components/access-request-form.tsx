"use client";

import { KeyRound } from "lucide-react";
import { useActionState } from "react";
import { INITIAL_ACTION_STATE, fieldError } from "@/shared/lib/action-state";
import { describedBy, Field, Textarea } from "@/shared/ui/form";
import { FormMessage } from "@/shared/ui/form-message";
import { SubmitButton } from "@/shared/ui/submit-button";
import type { PrivacyFieldKey } from "../../domain/privacy-fields";
import { requestFieldAccessAction } from "../actions";

type Props = {
  patientId: string;
  requestableFields: { key: PrivacyFieldKey; label: string }[];
  pendingRequest: { createdAt: string; fieldLabels: string[] } | null;
};

/** O profissional pede ao paciente para ver dados ocultos — só o paciente aprova. */
export function AccessRequestForm({ patientId, requestableFields, pendingRequest }: Props) {
  const [state, formAction] = useActionState(requestFieldAccessAction, INITIAL_ACTION_STATE);

  if (pendingRequest) {
    return (
      <p className="flex gap-2 rounded-2xl bg-ipe-50 px-4 py-3 text-sm text-ipe-800 ring-1 ring-inset ring-ipe-300">
        <KeyRound className="mt-0.5 size-4 shrink-0" aria-hidden />
        Pedido enviado ({pendingRequest.fieldLabels.join(", ")}). Aguardando a resposta do paciente.
      </p>
    );
  }

  if (requestableFields.length === 0) {
    return <p className="text-sm text-pedra">O paciente já compartilha todos os dados com você.</p>;
  }

  return (
    <details className="group rounded-2xl border border-linha">
      <summary className="flex items-center gap-2 px-4 py-3 font-semibold text-quaresmeira-700">
        <KeyRound className="size-4" aria-hidden />
        Pedir acesso a dados ocultos
      </summary>
      <form action={formAction} className="space-y-4 border-t border-linha p-4">
        <input type="hidden" name="patientId" value={patientId} />
        <FormMessage state={state} />
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Quais dados você precisa ver?</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {requestableFields.map((field) => (
              <label key={field.key} className="flex items-center gap-2 text-[0.95rem]">
                <input type="checkbox" name="fields" value={field.key} className="size-4 accent-quaresmeira-700" />
                {field.label}
              </label>
            ))}
          </div>
          {fieldError(state, "fields") && <p className="mt-1 text-sm font-medium text-urucum-700">{fieldError(state, "fields")?.[0]}</p>}
        </fieldset>
        <Field
          label="Motivo (o paciente vai ler)"
          htmlFor="reason"
          errors={fieldError(state, "reason")}
          hint="Ex.: preciso do CPF e do endereço para emitir uma receita de controle especial."
        >
          <Textarea id="reason" name="reason" maxLength={300} className="min-h-20" {...describedBy("reason", fieldError(state, "reason"), true)} />
        </Field>
        <SubmitButton size="sm" pendingLabel="Enviando…">
          Enviar pedido ao paciente
        </SubmitButton>
      </form>
    </details>
  );
}
