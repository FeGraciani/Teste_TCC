"use client";

import Link from "next/link";
import { useActionState } from "react";
import { INITIAL_ACTION_STATE, fieldError, valueOf } from "@/shared/lib/action-state";
import { describedBy, Field, Input } from "@/shared/ui/form";
import { FormMessage } from "@/shared/ui/form-message";
import { PasswordInput } from "@/shared/ui/password-input";
import { SubmitButton } from "@/shared/ui/submit-button";
import type { AccountLinkPurpose } from "../../domain/account-links";
import { completeAccountLinkAction, requestPasswordResetAction } from "../actions";

/** "Esqueci minha senha": pede o e-mail e envia o link de redefinição. */
export function ForgotPasswordForm({ backHref }: { backHref: string }) {
  const [state, formAction] = useActionState(requestPasswordResetAction, INITIAL_ACTION_STATE);
  const errors = (field: string) => fieldError(state, field);
  const sent = state.status === "success";

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <h1 className="text-[1.9rem] font-bold">Esqueceu a senha?</h1>
        <p className="text-pedra">
          Informe o e-mail da sua conta. Enviamos um link para você criar uma nova senha. Ninguém da clínica tem acesso a ela, nem a administração.
        </p>
      </div>

      <form action={formAction} className="space-y-5" noValidate>
        <FormMessage state={state} />
        {!sent && (
          <>
            <Field label="E-mail" htmlFor="email" errors={errors("email")}>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                defaultValue={valueOf(state, "email")}
                key={`email-${state.at ?? 0}`}
                {...describedBy("email", errors("email"))}
              />
            </Field>
            <SubmitButton className="w-full" size="lg" pendingLabel="Enviando…">
              Enviar link
            </SubmitButton>
          </>
        )}
      </form>

      <p className="text-[0.95rem] text-pedra">
        Lembrou a senha?{" "}
        <Link href={backHref} className="font-semibold text-quaresmeira-700 hover:underline">
          Voltar para a entrada
        </Link>
      </p>
    </div>
  );
}

type SetPasswordProps = {
  token: string;
  purpose: AccountLinkPurpose;
  firstName: string;
  maskedEmail: string;
};

/** Criação da senha pelo link do e-mail (convite ou redefinição). */
export function SetPasswordForm({ token, purpose, firstName, maskedEmail }: SetPasswordProps) {
  const [state, formAction] = useActionState(completeAccountLinkAction, INITIAL_ACTION_STATE);
  const errors = (field: string) => fieldError(state, field);
  const invite = purpose === "INVITE";

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <h1 className="text-[1.9rem] font-bold">{invite ? `Boas-vindas, ${firstName}` : `Nova senha, ${firstName}`}</h1>
        <p className="text-pedra">
          {invite
            ? `Crie a senha da conta ${maskedEmail}. Ela é só sua: ninguém da clínica tem acesso a ela.`
            : `Escolha uma nova senha para a conta ${maskedEmail}. Por segurança, as sessões abertas em outros aparelhos serão encerradas.`}
        </p>
      </div>

      <form action={formAction} className="space-y-5" noValidate>
        <input type="hidden" name="token" value={token} />
        <FormMessage state={state} />
        <Field
          label={invite ? "Crie sua senha" : "Nova senha"}
          htmlFor="password"
          errors={errors("password")}
          hint="8 ou mais caracteres, com letras e números."
        >
          <PasswordInput id="password" name="password" autoComplete="new-password" required {...describedBy("password", errors("password"), true)} />
        </Field>
        <Field label="Repita a senha" htmlFor="passwordConfirmation" errors={errors("passwordConfirmation")}>
          <PasswordInput
            id="passwordConfirmation"
            name="passwordConfirmation"
            autoComplete="new-password"
            required
            {...describedBy("passwordConfirmation", errors("passwordConfirmation"))}
          />
        </Field>
        <SubmitButton className="w-full" size="lg" pendingLabel="Salvando…">
          {invite ? "Criar senha" : "Salvar nova senha"}
        </SubmitButton>
      </form>
    </div>
  );
}
