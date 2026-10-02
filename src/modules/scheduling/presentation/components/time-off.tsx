"use client";

import { CalendarOff, Trash2 } from "lucide-react";
import { useActionState } from "react";
import { INITIAL_ACTION_STATE, fieldError, valueOf } from "@/shared/lib/action-state";
import { formatDateTime } from "@/shared/lib/datetime";
import { describedBy, Field, Input } from "@/shared/ui/form";
import { FormMessage } from "@/shared/ui/form-message";
import { SubmitButton } from "@/shared/ui/submit-button";
import { addTimeOffAction, removeTimeOffAction } from "../actions";

/**
 * Ausência ou imprevisto: bloqueia o período para novos agendamentos e,
 * se a pessoa quiser, cancela as consultas já marcadas avisando cada paciente.
 */
export function TimeOffForm({ today }: { today: string }) {
  const [state, formAction] = useActionState(addTimeOffAction, INITIAL_ACTION_STATE);
  const errors = (field: string) => fieldError(state, field);
  const cancelChecked = state.values ? state.values.cancelConflicts === "on" : true;

  return (
    <form action={formAction} className="space-y-5">
      <FormMessage state={state} />
      <div key={state.at ?? 0} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="De (data)" htmlFor="startDate" errors={errors("startDate")}>
            <Input
              id="startDate"
              name="startDate"
              type="date"
              min={today}
              required
              defaultValue={valueOf(state, "startDate", today)}
              {...describedBy("startDate", errors("startDate"))}
            />
          </Field>
          <Field label="Hora" htmlFor="startTime" errors={errors("startTime")}>
            <Input
              id="startTime"
              name="startTime"
              type="time"
              required
              defaultValue={valueOf(state, "startTime", "00:00")}
              {...describedBy("startTime", errors("startTime"))}
            />
          </Field>
          <Field label="Até (data)" htmlFor="endDate" errors={errors("endDate")}>
            <Input
              id="endDate"
              name="endDate"
              type="date"
              min={today}
              required
              defaultValue={valueOf(state, "endDate", today)}
              {...describedBy("endDate", errors("endDate"))}
            />
          </Field>
          <Field label="Hora" htmlFor="endTime" errors={errors("endTime")}>
            <Input
              id="endTime"
              name="endTime"
              type="time"
              required
              defaultValue={valueOf(state, "endTime", "23:59")}
              {...describedBy("endTime", errors("endTime"))}
            />
          </Field>
        </div>
        <Field
          label="Motivo"
          htmlFor="reason"
          optional
          errors={errors("reason")}
          hint="Se houver consultas canceladas, o motivo vai junto no aviso ao paciente."
        >
          <Input
            id="reason"
            name="reason"
            maxLength={120}
            placeholder="Ex.: congresso, férias, imprevisto de saúde"
            defaultValue={valueOf(state, "reason")}
            {...describedBy("reason", errors("reason"), true)}
          />
        </Field>
        <label className="flex gap-3 rounded-2xl bg-nevoa p-4">
          <input type="checkbox" name="cancelConflicts" defaultChecked={cancelChecked} className="mt-1 size-4 shrink-0 accent-quaresmeira-700" />
          <span>
            <span className="block font-semibold">Cancelar as consultas marcadas nesse período</span>
            <span className="block text-sm text-pedra">
              Cada paciente recebe um aviso no chat, com o motivo e o convite para escolher outro horário.
            </span>
          </span>
        </label>
      </div>
      <SubmitButton pendingLabel="Registrando…">
        <CalendarOff className="size-4" aria-hidden />
        Registrar ausência
      </SubmitButton>
    </form>
  );
}

export function TimeOffItem({ timeOff }: { timeOff: { id: string; startsAt: string; endsAt: string; reason: string | null } }) {
  const [state, formAction] = useActionState(removeTimeOffAction, INITIAL_ACTION_STATE);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div>
        <p className="font-semibold">
          {formatDateTime(timeOff.startsAt)} até {formatDateTime(timeOff.endsAt)}
        </p>
        <p className="text-sm text-pedra">{timeOff.reason ?? "Sem motivo informado"}</p>
        {state.status === "error" && <p className="text-sm font-medium text-urucum-700">{state.message}</p>}
      </div>
      <form action={formAction}>
        <input type="hidden" name="timeOffId" value={timeOff.id} />
        <SubmitButton variant="danger-quiet" size="sm" pendingLabel="Removendo…">
          <Trash2 className="size-4" aria-hidden />
          Remover
        </SubmitButton>
      </form>
    </li>
  );
}
