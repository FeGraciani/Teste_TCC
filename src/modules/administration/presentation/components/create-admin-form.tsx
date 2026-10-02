"use client";

import { useActionState } from "react";
import { INITIAL_ACTION_STATE, fieldError, valueOf } from "@/shared/lib/action-state";
import { describedBy, Field, Input } from "@/shared/ui/form";
import { FormMessage } from "@/shared/ui/form-message";
import { SubmitButton } from "@/shared/ui/submit-button";
import { createAdminAction } from "../actions";

export function CreateAdminForm() {
  const [state, formAction] = useActionState(createAdminAction, INITIAL_ACTION_STATE);
  const errors = (field: string) => fieldError(state, field);
  return (
    <form action={formAction} className="space-y-5">
      <FormMessage state={state} />
      <div key={state.at ?? 0} className="grid gap-5 sm:grid-cols-2">
        <Field label="Nome completo" htmlFor="admin-name" errors={errors("name")}>
          <Input
            id="admin-name"
            name="name"
            required
            defaultValue={state.status === "error" ? valueOf(state, "name") : ""}
            {...describedBy("admin-name", errors("name"))}
          />
        </Field>
        <Field label="E-mail" htmlFor="admin-email" errors={errors("email")}>
          <Input
            id="admin-email"
            name="email"
            type="email"
            required
            defaultValue={state.status === "error" ? valueOf(state, "email") : ""}
            {...describedBy("admin-email", errors("email"))}
          />
        </Field>
      </div>
      <p className="text-sm text-pedra">A pessoa recebe um convite por e-mail para criar a própria senha.</p>
      <SubmitButton size="sm" pendingLabel="Criando…">
        Criar conta e enviar convite
      </SubmitButton>
    </form>
  );
}
