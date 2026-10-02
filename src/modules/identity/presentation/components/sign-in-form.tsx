"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import { siteConfig } from "@/config/site";
import { cn } from "@/shared/lib/cn";
import { INITIAL_ACTION_STATE, valueOf } from "@/shared/lib/action-state";
import { Callout } from "@/shared/ui/callout";
import { Field, Input } from "@/shared/ui/form";
import { FormMessage } from "@/shared/ui/form-message";
import { PasswordInput } from "@/shared/ui/password-input";
import { SubmitButton } from "@/shared/ui/submit-button";
import { PORTALS, PORTAL_KEYS, type PortalKey } from "../../domain/portals";
import { signInAction } from "../actions";

export type DemoAccount = { label: string; email: string; password: string };

type Props = {
  portal: PortalKey;
  next: string;
  /** Contas de demonstração (somente quando DEMO_MODE=true). */
  demoAccounts?: DemoAccount[];
  /** Aviso no topo (ex.: senha criada pelo link do e-mail). */
  notice?: string | null;
};

export function SignInForm({ portal, next, demoAccounts = [], notice = null }: Props) {
  const [state, formAction] = useActionState(signInAction, INITIAL_ACTION_STATE);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const info = PORTALS[portal];

  const portalHref = (key: PortalKey) => {
    const params = new URLSearchParams();
    if (key !== "paciente") params.set("perfil", key);
    if (next) params.set("next", next);
    const query = params.toString();
    return `/entrar${query ? `?${query}` : ""}`;
  };

  const fillDemo = (account: DemoAccount) => {
    if (emailRef.current) emailRef.current.value = account.email;
    if (passwordRef.current) passwordRef.current.value = account.password;
    passwordRef.current?.form?.requestSubmit();
  };

  return (
    <div className="space-y-7">
      <nav aria-label="Tipo de acesso">
        <ul className="grid grid-cols-3 gap-1 rounded-2xl bg-nevoa-escura p-1">
          {PORTAL_KEYS.map((key) => (
            <li key={key}>
              <Link
                href={portalHref(key)}
                replace
                aria-current={key === portal ? "page" : undefined}
                className={cn(
                  "block rounded-xl px-2 py-2.5 text-center text-sm font-semibold transition-colors sm:text-[0.95rem]",
                  key === portal ? "bg-papel text-quaresmeira-800 shadow-suave" : "text-pedra hover:text-tinta",
                )}
              >
                {PORTALS[key].label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-2">
        <h1 className="text-[1.9rem] font-bold">{info.title}</h1>
        <p className="text-pedra">{info.description}</p>
      </div>

      <form action={formAction} className="space-y-5" noValidate>
        <input type="hidden" name="portal" value={portal} />
        <input type="hidden" name="next" value={next} />

        {notice && state.status === "idle" && (
          <Callout tone="success" role="status">
            {notice}
          </Callout>
        )}
        <FormMessage state={state} />

        <Field label="E-mail" htmlFor="email">
          <Input
            ref={emailRef}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            defaultValue={valueOf(state, "email")}
            key={`email-${state.at ?? 0}`}
          />
        </Field>

        <Field label="Senha" htmlFor="password">
          <PasswordInput ref={passwordRef} id="password" name="password" autoComplete="current-password" required />
        </Field>
        <p className="-mt-2 text-right text-sm">
          <Link
            href={portal === "paciente" ? "/esqueci-a-senha" : `/esqueci-a-senha?perfil=${portal}`}
            className="font-semibold text-quaresmeira-700 hover:underline"
          >
            Esqueci minha senha
          </Link>
        </p>

        <SubmitButton className="w-full" size="lg" pendingLabel="Entrando…">
          Entrar
        </SubmitButton>
      </form>

      <div className="space-y-2 text-[0.95rem] text-pedra">
        {portal === "paciente" ? (
          <p>
            Ainda não tem conta?{" "}
            <Link href="/cadastro" className="font-semibold text-quaresmeira-700 hover:underline">
              Criar conta de paciente
            </Link>
          </p>
        ) : portal === "profissional" ? (
          <p>Seu acesso é criado pela administração da clínica: você recebe um convite por e-mail para criar a sua senha.</p>
        ) : (
          <p>Acesso restrito à equipe administrativa da clínica.</p>
        )}
        <p>
          Problemas para entrar? Fale com a clínica pelo{" "}
          <a href={siteConfig.contact.phoneHref} className="font-semibold text-tinta hover:underline">
            {siteConfig.contact.phone}
          </a>
          .
        </p>
      </div>

      {demoAccounts.length > 0 && (
        <section className="rounded-2xl border border-dashed border-quaresmeira-300 bg-quaresmeira-50 p-4" aria-labelledby="demo-titulo">
          <h2 id="demo-titulo" className="font-bold text-quaresmeira-900">
            Contas de demonstração
          </h2>
          <p className="mt-1 text-sm text-quaresmeira-900">Toque numa conta para entrar com ela. Desative em produção (DEMO_MODE=false).</p>
          <ul className="mt-3 grid gap-2">
            {demoAccounts.map((account) => (
              <li key={account.email}>
                <button
                  type="button"
                  onClick={() => fillDemo(account)}
                  className="flex w-full flex-col rounded-xl bg-papel px-3 py-2 text-left ring-1 ring-quaresmeira-200 hover:ring-quaresmeira-500"
                >
                  <span className="font-semibold">{account.label}</span>
                  <span className="text-sm text-pedra">{account.email}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
