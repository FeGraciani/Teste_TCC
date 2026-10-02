"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { INITIAL_ACTION_STATE, fieldError, valueOf } from "@/shared/lib/action-state";
import { describedBy, Field, Input } from "@/shared/ui/form";
import { FormMessage } from "@/shared/ui/form-message";
import { PasswordInput } from "@/shared/ui/password-input";
import { SubmitButton } from "@/shared/ui/submit-button";
import { DEFAULT_PRESET, NAMED_PRESET_KEYS, PRIVACY_PRESETS, type NamedPresetKey } from "@/modules/privacy/domain/privacy-fields";
import { displayNameFor } from "@/modules/privacy/domain/projection";
import { signUpAction } from "../actions";

const EXAMPLE_NAME = "Mariana Souza de Oliveira";

export function SignUpForm() {
  const [state, formAction] = useActionState(signUpAction, INITIAL_ACTION_STATE);
  const [name, setName] = useState(() => valueOf(state, "name"));
  const selectedPreset = (valueOf(state, "privacyPreset", DEFAULT_PRESET) as NamedPresetKey) ?? DEFAULT_PRESET;
  const [preset, setPreset] = useState<NamedPresetKey>(selectedPreset);

  const sampleName = name.trim().split(/\s+/).length >= 2 ? name.trim() : EXAMPLE_NAME;
  const previewFor = (key: NamedPresetKey) =>
    key === "ANONYMOUS"
      ? "um codinome, como Jacarandá-27"
      : displayNameFor({ fullName: sampleName, preferredName: null, pseudonym: "" }, PRIVACY_PRESETS[key].fields.name);

  const errors = (field: string) => fieldError(state, field);

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <h1 className="text-[1.9rem] font-bold">Crie sua conta</h1>
        <p className="text-pedra">Leva dois minutos. Depois você escolhe o profissional e um horário livre na agenda.</p>
      </div>

      <form action={formAction} className="space-y-5" noValidate>
        <FormMessage state={state} />

        <div key={state.at ?? 0} className="space-y-5">
          <Field
            label="Nome completo"
            htmlFor="name"
            errors={errors("name")}
            hint="Fica guardado com a clínica. Você decide como ele aparece para cada profissional."
          >
            <Input
              id="name"
              name="name"
              autoComplete="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              {...describedBy("name", errors("name"), true)}
            />
          </Field>

          <Field label="E-mail" htmlFor="email" errors={errors("email")}>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              defaultValue={valueOf(state, "email")}
              {...describedBy("email", errors("email"))}
            />
          </Field>

          <Field label="Data de nascimento" htmlFor="birthDate" errors={errors("birthDate")} hint="O atendimento pelo app é para maiores de 18 anos.">
            <Input
              id="birthDate"
              name="birthDate"
              type="date"
              autoComplete="bday"
              required
              defaultValue={valueOf(state, "birthDate")}
              {...describedBy("birthDate", errors("birthDate"), true)}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Senha" htmlFor="password" errors={errors("password")} hint="8 ou mais caracteres, com letras e números.">
              <PasswordInput
                id="password"
                name="password"
                autoComplete="new-password"
                required
                {...describedBy("password", errors("password"), true)}
              />
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
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Como você quer aparecer para os profissionais?</legend>
            <p className="text-sm text-pedra">Você pode mudar quando quiser, e até escolher algo diferente para cada profissional.</p>
            <div className="grid gap-2">
              {NAMED_PRESET_KEYS.map((key) => (
                <label
                  key={key}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-2xl border bg-papel p-4 transition-colors",
                    preset === key ? "border-quaresmeira-500 ring-3 ring-quaresmeira-100" : "border-linha-forte hover:border-quaresmeira-300",
                  )}
                >
                  <input
                    type="radio"
                    name="privacyPreset"
                    value={key}
                    checked={preset === key}
                    onChange={() => setPreset(key)}
                    className="mt-1 size-4 accent-quaresmeira-700"
                  />
                  <span className="space-y-1">
                    <span className="flex flex-wrap items-center gap-2 font-semibold">
                      {PRIVACY_PRESETS[key].label}
                      {key === DEFAULT_PRESET && (
                        <span className="rounded-md bg-folha-100 px-2 py-0.5 text-xs font-bold text-folha-800">recomendado</span>
                      )}
                    </span>
                    <span className="block text-sm text-pedra">{PRIVACY_PRESETS[key].summary}</span>
                    <span className="block text-sm">
                      Seu nome aparece como <strong className="font-semibold text-quaresmeira-800">{previewFor(key)}</strong>
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {errors("privacyPreset") && <p className="text-sm font-medium text-urucum-700">{errors("privacyPreset")?.[0]}</p>}
          </fieldset>

          <div className="space-y-1.5">
            <label className="flex gap-3 text-[0.95rem]">
              <input
                type="checkbox"
                name="acceptTerms"
                defaultChecked={valueOf(state, "acceptTerms") === "on"}
                className="mt-1 size-4 shrink-0 accent-quaresmeira-700"
                aria-invalid={errors("acceptTerms") ? true : undefined}
              />
              <span>
                Li e concordo com os{" "}
                <Link href="/termos-de-uso" target="_blank" className="font-semibold text-quaresmeira-700 underline">
                  Termos de uso
                </Link>{" "}
                e a{" "}
                <Link href="/politica-de-privacidade" target="_blank" className="font-semibold text-quaresmeira-700 underline">
                  Política de privacidade
                </Link>
                , e autorizo o uso dos meus dados de saúde para o meu atendimento.
              </span>
            </label>
            {errors("acceptTerms") && <p className="text-sm font-medium text-urucum-700">{errors("acceptTerms")?.[0]}</p>}
          </div>
        </div>

        <SubmitButton className="w-full" size="lg" pendingLabel="Criando sua conta…">
          Criar conta
        </SubmitButton>
      </form>

      <p className="text-[0.95rem] text-pedra">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-semibold text-quaresmeira-700 hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
