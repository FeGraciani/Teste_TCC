"use client";

import { useEffect, useRef } from "react";
import type { ActionState } from "@/shared/lib/action-state";
import { Callout } from "./callout";

/** Mensagem de retorno de um formulário (sucesso ou erro), anunciada a leitores de tela. */
export function FormMessage({ state, className }: { state: ActionState; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Erro ou sucesso: se a mensagem estiver fora da tela (ex.: formulário longo), rola até ela.
    if (state.status !== "idle") ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [state.at, state.status]);

  if (state.status === "idle" || !state.message) return null;
  return (
    <div ref={ref} className={className}>
      <Callout tone={state.status === "success" ? "success" : "danger"} role={state.status === "success" ? "status" : "alert"}>
        {state.message}
        {state.devLink && <DevLinkNote href={state.devLink} />}
      </Callout>
    </div>
  );
}

/** Link de acesso exibido apenas em desenvolvimento local (sem servidor de e-mail configurado). */
export function DevLinkNote({ href }: { href: string }) {
  return (
    <span className="mt-2 block rounded-xl bg-papel/70 px-3 py-2 text-sm text-tinta ring-1 ring-linha">
      <strong>Desenvolvimento, sem e-mail configurado:</strong> o e-mail foi mostrado no terminal do servidor.{" "}
      <a href={href} className="break-all">
        Abrir o link de acesso
      </a>
      . Em produção, o link vai só para o e-mail da pessoa e não aparece aqui.
    </span>
  );
}
