"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export type NavCounters = {
  unreadMessages?: number;
  pendingRequests?: number;
};

const CountersContext = createContext<NavCounters>({});

const REFRESH_INTERVAL_MS = 30_000;

/**
 * Mantém atualizados os contadores do menu (mensagens não lidas, pedidos
 * pendentes). O layout não é renderizado de novo a cada navegação, então
 * os números são buscados a cada troca de página, ao voltar para a aba e
 * periodicamente.
 */
export function CountersProvider({ initial, children }: { initial: NavCounters; children: ReactNode }) {
  const [counters, setCounters] = useState<NavCounters>(initial);
  const pathname = usePathname();
  const firstRun = useRef(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/contadores", { cache: "no-store" });
        if (response.ok && !cancelled) setCounters((await response.json()) as NavCounters);
      } catch {
        // Sem conexão: mantém os últimos números conhecidos.
      }
    };

    if (firstRun.current) firstRun.current = false;
    else void load();

    const interval = window.setInterval(load, REFRESH_INTERVAL_MS);
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname]);

  return <CountersContext value={counters}>{children}</CountersContext>;
}

export function useCounters(): NavCounters {
  return useContext(CountersContext);
}
