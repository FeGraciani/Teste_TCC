"use client";

import { useActionState } from "react";
import { INITIAL_ACTION_STATE } from "@/shared/lib/action-state";
import { SubmitButton } from "@/shared/ui/submit-button";
import { recordOutcomeAction } from "../actions";

/** Depois do início da consulta: registrar se aconteceu ou se o paciente faltou. */
export function OutcomeButtons({ appointmentId }: { appointmentId: string }) {
  const [state, formAction] = useActionState(recordOutcomeAction, INITIAL_ACTION_STATE);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <SubmitButton name="outcome" value="COMPLETED" variant="success" size="sm">
        Realizada
      </SubmitButton>
      <SubmitButton name="outcome" value="NO_SHOW" variant="secondary" size="sm">
        Paciente faltou
      </SubmitButton>
      {state.status === "error" && (
        <p className="w-full text-sm font-medium text-urucum-700" role="alert">
          {state.message}
        </p>
      )}
    </form>
  );
}
