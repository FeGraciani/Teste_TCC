"use client";

import { useActionState } from "react";
import { INITIAL_ACTION_STATE, fieldError } from "@/shared/lib/action-state";
import { describedBy, Field } from "@/shared/ui/form";
import { FormMessage } from "@/shared/ui/form-message";
import { PasswordInput } from "@/shared/ui/password-input";
import { SubmitButton } from "@/shared/ui/submit-button";
import { changePasswordAction } from "../actions";

export function ChangePasswordForm() {
  const [state, formAction] = useActionState(changePasswordAction, INITIAL_ACTION_STATE);
  const errors = (field: string) => fieldError(state, field);
  return (
    <form action={formAction} className="space-y-5" key={state.status === "success" ? state.at : "form"}>
      <FormMessage state={state} />
      <Field label="Senha atual" htmlFor="currentPassword" errors={errors("currentPassword")}>
        <PasswordInput
          id="currentPassword"
          name="currentPassword"
          autoComplete="current-password"
          required
          {...describedBy("currentPassword", errors("currentPassword"))}
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nova senha" htmlFor="newPassword" errors={errors("newPassword")} hint="8 ou mais caracteres, com letras e números.">
          <PasswordInput
            id="newPassword"
            name="newPassword"
            autoComplete="new-password"
            required
            {...describedBy("newPassword", errors("newPassword"), true)}
          />
        </Field>
        <Field label="Repita a nova senha" htmlFor="newPasswordConfirmation" errors={errors("newPasswordConfirmation")}>
          <PasswordInput
            id="newPasswordConfirmation"
            name="newPasswordConfirmation"
            autoComplete="new-password"
            required
            {...describedBy("newPasswordConfirmation", errors("newPasswordConfirmation"))}
          />
        </Field>
      </div>
      <SubmitButton pendingLabel="Salvando…">Trocar senha</SubmitButton>
    </form>
  );
}
