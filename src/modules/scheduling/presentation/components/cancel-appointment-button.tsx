"use client";

import { useActionState, useState, type ReactNode } from "react";
import { INITIAL_ACTION_STATE, fieldError, type ActionState } from "@/shared/lib/action-state";
import { Button } from "@/shared/ui/button";
import { Dialog } from "@/shared/ui/dialog";
import { describedBy, Field, Textarea } from "@/shared/ui/form";
import { FormMessage } from "@/shared/ui/form-message";
import { SubmitButton } from "@/shared/ui/submit-button";
import { cancelAppointmentAction } from "../actions";

type Props = {
  appointmentId: string;
  /** Resumo exibido na confirmação (ex.: "Quinta, 8 de outubro, às 14:00 com Dra. Helena"). */
  summary: ReactNode;
  /** Profissional e administração precisam informar o motivo (ele vai para o paciente). */
  requireReason: boolean;
  label?: string;
  size?: "sm" | "md";
};

export function CancelAppointmentButton({ appointmentId, summary, requireReason, label = "Cancelar consulta", size = "sm" }: Props) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await cancelAppointmentAction(previous, formData);
    if (result.status === "success") setOpen(false);
    return result;
  }, INITIAL_ACTION_STATE);
  const reasonId = `motivo-${appointmentId}`;

  return (
    <>
      <Button variant="danger-quiet" size={size} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Cancelar esta consulta?" description={summary}>
        <form action={formAction} className="space-y-5">
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <FormMessage state={state.status === "error" ? state : INITIAL_ACTION_STATE} />
          <Field
            label={requireReason ? "Motivo do cancelamento" : "Quer contar o motivo?"}
            htmlFor={reasonId}
            optional={!requireReason}
            errors={fieldError(state, "reason")}
            hint={
              requireReason
                ? "O paciente recebe este motivo pelo chat, junto com o convite para escolher outro horário."
                : "O profissional recebe o aviso pelo chat."
            }
          >
            <Textarea
              id={reasonId}
              name="reason"
              maxLength={300}
              required={requireReason}
              className="min-h-24"
              placeholder={requireReason ? "Ex.: precisei me ausentar por um compromisso médico." : undefined}
              {...describedBy(reasonId, fieldError(state, "reason"), true)}
            />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Manter consulta
            </Button>
            <SubmitButton variant="danger" pendingLabel="Cancelando…">
              Cancelar consulta
            </SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
