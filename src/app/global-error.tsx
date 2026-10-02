"use client";

import "@fontsource-variable/atkinson-hyperlegible-next";
import "./globals.css";
import { copyrightLine } from "@/config/site";

/** Último recurso quando o próprio layout raiz falha. */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
        <h1 className="text-[1.8rem] font-bold">Algo saiu do lugar</h1>
        <p className="max-w-md text-pedra">Tivemos um problema para carregar o Alento. Tente de novo em instantes.</p>
        <button
          type="button"
          onClick={() => retry()}
          className="h-11 rounded-xl bg-quaresmeira-700 px-5 font-semibold text-white hover:bg-quaresmeira-800"
        >
          Tentar de novo
        </button>
        <p className="text-sm text-pedra">Em crise? Ligue 188 (CVV, 24h) ou 192 (SAMU).</p>
        <p className="text-sm text-pedra">{copyrightLine()}</p>
      </body>
    </html>
  );
}
