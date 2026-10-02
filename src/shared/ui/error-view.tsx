"use client";

import { RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { Button } from "./button";

/** Conteúdo das telas de erro (error.tsx) das áreas logadas e do site. */
/** `retry` busca os dados de novo no servidor e redesenha a tela (o `reset` só limparia o erro no navegador). */
export function ErrorView({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg space-y-4 py-16">
      <h1 className="text-[1.8rem] font-bold">Não conseguimos carregar esta tela</h1>
      <p className="text-pedra">
        Pode ter sido uma instabilidade de conexão. Seus dados estão seguros. Tente de novo; se o problema continuar, fale com a clínica
        {error.digest ? ` e informe o código ${error.digest}` : ""}.
      </p>
      <Button onClick={() => retry()}>
        <RotateCcw className="size-4" aria-hidden />
        Tentar de novo
      </Button>
    </div>
  );
}
