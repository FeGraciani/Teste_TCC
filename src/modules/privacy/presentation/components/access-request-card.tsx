"use client";

import { KeyRound } from "lucide-react";
import { useActionState } from "react";
import { INITIAL_ACTION_STATE } from "@/shared/lib/action-state";
import { formatDateTime } from "@/shared/lib/datetime";
import { FormMessage } from "@/shared/ui/form-message";
import { SubmitButton } from "@/shared/ui/submit-button";
import { respondToAccessRequestAction } from "../actions";

type Props = {
  request: { id: string; professionalName: string; professionalTitle: string; fieldLabels: string[]; reason: string; createdAt: string };
};

/** Pedido de um profissional para ver dados ocultos. Só o paciente decide. */
export function AccessRequestCard({ request }: Props) {
  const [state, formAction] = useActionState(respondToAccessRequestAction, INITIAL_ACTION_STATE);
  return (
    <article className="space-y-4 rounded-[1.25rem] border border-ipe-300 bg-ipe-50 p-5">
      <div className="flex gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ipe-100 text-ipe-800">
          <KeyRound className="size-5" aria-hidden />
        </span>
        <div className="space-y-1">
          <p className="font-bold">
            {request.professionalName} ({request.professionalTitle}) pediu para ver: {request.fieldLabels.join(", ")}
          </p>
          <p className="text-[0.95rem]">“{request.reason}”</p>
          <p className="text-sm text-pedra">Pedido feito em {formatDateTime(request.createdAt)}</p>
        </div>
      </div>
      <p className="text-sm text-ipe-800">
        Se você liberar, só esses dados ficam visíveis, e só para este profissional, por cima das suas preferências. Dá para revogar quando quiser.
      </p>
      <FormMessage state={state} />
      <form action={formAction} className="flex flex-wrap gap-2">
        <input type="hidden" name="requestId" value={request.id} />
        <SubmitButton name="decision" value="approve" size="sm">
          Liberar só para este profissional
        </SubmitButton>
        <SubmitButton name="decision" value="decline" variant="secondary" size="sm">
          Recusar
        </SubmitButton>
      </form>
    </article>
  );
}
