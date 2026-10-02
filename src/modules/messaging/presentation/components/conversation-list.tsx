import { Info } from "lucide-react";
import Link from "next/link";
import { cn } from "@/shared/lib/cn";
import { formatDayMonth, formatTime, toDateKey } from "@/shared/lib/datetime";
import { Avatar } from "@/shared/ui/avatar";
import type { ConversationSummary } from "../../application/chat-service";

function shortWhen(date: Date): string {
  return toDateKey(date) === toDateKey(new Date()) ? formatTime(date) : formatDayMonth(date);
}

/** Lista de conversas (pacientes ou profissionais), com prévia e não lidas. */
export function ConversationList({
  conversations,
  selectedId,
  basePath,
}: {
  conversations: ConversationSummary[];
  selectedId: string | null;
  basePath: string;
}) {
  return (
    <ul className="divide-y divide-linha">
      {conversations.map((conversation) => {
        const active = conversation.id === selectedId;
        const reserved = conversation.counterpart.preset === "ANONYMOUS";
        return (
          <li key={conversation.id}>
            <Link
              href={`${basePath}?c=${conversation.id}`}
              aria-current={active ? "page" : undefined}
              className={cn("flex gap-3 px-4 py-3.5 transition-colors", active ? "bg-quaresmeira-50" : "hover:bg-nevoa")}
            >
              <Avatar
                monogram={conversation.counterpart.monogram}
                tone={
                  conversation.counterpart.specialty
                    ? conversation.counterpart.specialty === "PSYCHIATRY"
                      ? "green"
                      : "violet"
                    : reserved
                      ? "mist"
                      : "violet"
                }
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={cn("truncate", conversation.unread > 0 ? "font-bold" : "font-semibold")}>{conversation.counterpart.name}</p>
                  <span className="shrink-0 text-xs text-pedra">{shortWhen(conversation.lastMessageAt)}</span>
                </div>
                <p className="truncate text-sm text-pedra">{conversation.counterpart.subtitle}</p>
                {conversation.preview && (
                  <p className={cn("mt-0.5 flex items-center gap-1 truncate text-sm", conversation.unread > 0 ? "text-tinta" : "text-pedra")}>
                    {conversation.previewIsSystem && <Info className="size-3.5 shrink-0 text-ipe-800" aria-label="Aviso automático" />}
                    <span className="truncate">{conversation.preview}</span>
                  </p>
                )}
              </div>
              {conversation.unread > 0 && (
                <span className="mt-1 grid h-6 min-w-6 place-items-center self-start rounded-full bg-ipe-400 px-1.5 text-xs font-bold text-tinta">
                  {conversation.unread}
                  <span className="sr-only"> mensagens não lidas</span>
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
