"use client";

import { ArrowLeft, Info, LoaderCircle, SendHorizontal } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import { CHAT_POLL_INTERVAL_MS } from "@/config/clinic";
import { cn } from "@/shared/lib/cn";
import { formatTime, relativeDayLabel, toDateKey } from "@/shared/lib/datetime";
import { Avatar } from "@/shared/ui/avatar";
import { CrisisNote } from "@/shared/ui/crisis-note";
import type { ChatMessage } from "../../application/chat-service";
import { sendMessageAction } from "../actions";

const MAX_LENGTH = 2000;

type Props = {
  conversationId: string;
  counterpart: {
    name: string;
    subtitle: string;
    monogram: string;
    tone: "violet" | "green" | "mist";
  };
  initialMessages: ChatMessage[];
  backHref: string;
  /** Conteúdo extra no cabeçalho (ex.: link para a ficha do paciente). */
  headerAction?: ReactNode;
  /** Quando a outra parte não tem mais acesso: a conversa fica só para leitura, com este aviso. */
  readOnlyNotice?: string | null;
};

function merge(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (incoming.length === 0) return current;
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Conversa entre paciente e profissional, com atualização automática. */
export function ChatThread({ conversationId, counterpart, initialMessages, backHref, headerAction, readOnlyNotice = null }: Props) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [pending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const lastCreatedAt = messages.at(-1)?.createdAt ?? null;
  const lastRef = useRef(lastCreatedAt);

  useEffect(() => {
    lastRef.current = lastCreatedAt;
  }, [lastCreatedAt]);

  // Mantém a conversa rolada para o fim quando chegam mensagens (se a pessoa já estava no fim).
  useLayoutEffect(() => {
    const list = listRef.current;
    if (list && stickToBottom.current) list.scrollTop = list.scrollHeight;
  }, [messages.length]);

  const poll = useCallback(async () => {
    try {
      const after = lastRef.current;
      const response = await fetch(`/api/conversas/${conversationId}/mensagens${after ? `?depois=${encodeURIComponent(after)}` : ""}`, {
        cache: "no-store",
      });
      if (response.status === 401) {
        setSessionExpired(true);
        return;
      }
      if (!response.ok) return;
      const data = (await response.json()) as { messages: ChatMessage[] };
      setSessionExpired(false);
      setMessages((current) => merge(current, data.messages));
    } catch {
      // Sem conexão: tenta de novo no próximo ciclo.
    }
  }, [conversationId]);

  useEffect(() => {
    const interval = window.setInterval(poll, CHAT_POLL_INTERVAL_MS);
    const onVisible = () => document.visibilityState === "visible" && void poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll]);

  const send = () => {
    const body = draft.trim();
    if (!body || pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await sendMessageAction(conversationId, body);
        if (result.ok) {
          stickToBottom.current = true;
          setMessages((current) => merge(current, [result.message]));
          setDraft("");
        } else {
          setError(result.error);
        }
      } catch {
        // Falha de rede: a mensagem continua no campo para tentar de novo.
        setError("Sem conexão com o servidor. Sua mensagem não foi enviada; ela continua no campo para você tentar de novo.");
      }
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-linha px-4 py-3">
        <Link
          href={backHref}
          className="grid size-10 place-items-center rounded-xl text-pedra hover:bg-nevoa lg:hidden"
          aria-label="Voltar para as conversas"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <Avatar monogram={counterpart.monogram} tone={counterpart.tone} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{counterpart.name}</p>
          <p className="truncate text-sm text-pedra">{counterpart.subtitle}</p>
        </div>
        {headerAction}
      </header>

      <div
        ref={listRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          stickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
        }}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-nevoa/60 px-4 py-5"
        role="log"
        aria-live="polite"
        aria-label={`Conversa com ${counterpart.name}`}
      >
        {messages.length === 0 && <p className="py-10 text-center text-pedra">Nenhuma mensagem ainda. Diga um oi ou avise sobre algum imprevisto.</p>}
        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const newDay = !previous || toDateKey(previous.createdAt) !== toDateKey(message.createdAt);
          return (
            <div key={message.id}>
              {newDay && (
                <p className="my-3 text-center">
                  <span className="rounded-full bg-papel px-3 py-1 text-xs font-semibold text-pedra ring-1 ring-linha">
                    {relativeDayLabel(message.createdAt)}
                  </span>
                </p>
              )}
              <MessageBubble message={message} />
            </div>
          );
        })}
      </div>

      <div className="space-y-2 border-t border-linha bg-papel px-4 py-3">
        {sessionExpired && (
          <p className="rounded-xl bg-ipe-50 px-3 py-2 text-sm text-ipe-800 ring-1 ring-inset ring-ipe-300" role="alert">
            Sua sessão expirou e as mensagens novas não estão chegando.{" "}
            <a href="/entrar" className="font-semibold underline">
              Entre de novo
            </a>{" "}
            para continuar a conversa.
          </p>
        )}
        {error && (
          <p className="text-sm font-medium text-urucum-700" role="alert">
            {error}
          </p>
        )}
        {readOnlyNotice ? (
          <p className="rounded-xl bg-nevoa px-3 py-2.5 text-sm text-pedra ring-1 ring-inset ring-linha" role="status">
            {readOnlyNotice}
          </p>
        ) : (
          <div className="flex items-end gap-2">
            <label htmlFor={`mensagem-${conversationId}`} className="sr-only">
              Escreva sua mensagem
            </label>
            <textarea
              id={`mensagem-${conversationId}`}
              value={draft}
              onChange={(event) => setDraft(event.target.value.slice(0, MAX_LENGTH))}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Escreva sua mensagem"
              className="field-sizing-content max-h-40 min-h-11 flex-1 resize-none rounded-xl border border-linha-forte bg-papel px-3.5 py-2.5 text-[0.95rem] focus:border-quaresmeira-500 focus:ring-3 focus:ring-quaresmeira-100 focus:outline-none"
            />
            <button
              type="button"
              onClick={send}
              disabled={pending || draft.trim().length === 0}
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-quaresmeira-700 text-white hover:bg-quaresmeira-800 disabled:opacity-50"
              aria-label="Enviar mensagem"
            >
              {pending ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <SendHorizontal className="size-5" aria-hidden />}
            </button>
          </div>
        )}
        <CrisisNote compact className="text-xs" />
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.kind === "SYSTEM") {
    return (
      <div className="mx-auto flex max-w-lg gap-2 rounded-2xl bg-ipe-50 px-3.5 py-2.5 text-sm text-ipe-800 ring-1 ring-inset ring-ipe-300">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p className="whitespace-pre-line text-tinta">{message.body}</p>
          <p className="mt-1 text-xs">Aviso automático, {formatTime(message.createdAt)}</p>
        </div>
      </div>
    );
  }
  return (
    <div className={cn("flex", message.mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 sm:max-w-[70%]",
          message.mine ? "rounded-br-md bg-quaresmeira-700 text-white" : "rounded-bl-md bg-papel text-tinta ring-1 ring-linha",
        )}
      >
        <p className="break-words whitespace-pre-line">{message.body}</p>
        <p className={cn("mt-1 text-right text-xs", message.mine ? "text-quaresmeira-100" : "text-pedra")}>
          <span className="sr-only">{message.mine ? "Você, " : ""}</span>
          {formatTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}
