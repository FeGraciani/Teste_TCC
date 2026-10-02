"use client";

import { MailCheck, Send } from "lucide-react";
import { useActionState, useState } from "react";
import { INITIAL_ACTION_STATE } from "@/shared/lib/action-state";
import { Button } from "@/shared/ui/button";
import { DevLinkNote } from "@/shared/ui/form-message";
import { SubmitButton } from "@/shared/ui/submit-button";
import { sendAccessLinkAction, setUserActiveAction } from "../actions";

type Props = {
  userId: string;
  active: boolean;
  name: string;
  canDeactivate?: boolean;
  /** A pessoa ainda não aceitou o convite (nunca criou a senha). */
  pendingInvite?: boolean;
  /** Consultas futuras que serão canceladas se o profissional for desativado. */
  upcomingAppointments?: number;
};

/**
 * Ações sobre uma conta. A administração NUNCA define nem vê senhas: ela só
 * pede que um link de acesso seja enviado ao e-mail do dono da conta.
 */
export function AccountActions({ userId, active, name, canDeactivate = true, pendingInvite = false, upcomingAppointments = 0 }: Props) {
  const [toggleState, toggleAction] = useActionState(setUserActiveAction, INITIAL_ACTION_STATE);
  const [linkState, linkAction] = useActionState(sendAccessLinkAction, INITIAL_ACTION_STATE);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {active && (
          <form action={linkAction}>
            <input type="hidden" name="userId" value={userId} />
            <SubmitButton variant="quiet" size="sm" pendingLabel="Enviando…">
              {pendingInvite ? <MailCheck className="size-4" aria-hidden /> : <Send className="size-4" aria-hidden />}
              {pendingInvite ? "Reenviar convite" : "Enviar link de nova senha"}
            </SubmitButton>
          </form>
        )}
        {canDeactivate &&
          (active && !confirming ? (
            <Button variant="danger-quiet" size="sm" onClick={() => setConfirming(true)}>
              Desativar acesso
            </Button>
          ) : (
            <form action={toggleAction} className="flex flex-wrap items-center gap-1.5">
              <input type="hidden" name="userId" value={userId} />
              <input type="hidden" name="active" value={active ? "false" : "true"} />
              {active && (
                <span className="text-sm text-pedra">
                  Desativar {name}?
                  {upcomingAppointments > 0 &&
                    ` ${upcomingAppointments === 1 ? "A consulta futura será cancelada" : `As ${upcomingAppointments} consultas futuras serão canceladas`} e os pacientes, avisados.`}
                </span>
              )}
              <SubmitButton variant={active ? "danger" : "secondary"} size="sm" pendingLabel="Salvando…">
                {active ? "Sim, desativar" : "Reativar acesso"}
              </SubmitButton>
              {active && (
                <Button variant="quiet" size="sm" onClick={() => setConfirming(false)}>
                  Cancelar
                </Button>
              )}
            </form>
          ))}
      </div>
      {linkState.status !== "idle" && (
        <div
          className={
            linkState.status === "success"
              ? "rounded-xl bg-quaresmeira-50 px-3 py-2 text-sm text-quaresmeira-900 ring-1 ring-inset ring-quaresmeira-200"
              : "text-sm font-medium text-urucum-700"
          }
          role="status"
        >
          {linkState.message}
          {linkState.devLink && <DevLinkNote href={linkState.devLink} />}
        </div>
      )}
      {toggleState.status !== "idle" && (
        <p className={toggleState.status === "error" ? "text-sm font-medium text-urucum-700" : "text-sm text-folha-800"} role="status">
          {toggleState.message}
        </p>
      )}
    </div>
  );
}
