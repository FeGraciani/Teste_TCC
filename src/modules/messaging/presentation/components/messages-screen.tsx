import { ClipboardList, MessageCircle } from "lucide-react";
import Link from "next/link";
import type { Actor } from "@/shared/application/actor";
import { isDomainError } from "@/shared/errors";
import { cn } from "@/shared/lib/cn";
import { EmptyState } from "@/shared/ui/layout";
import { findConversationIdWith, listConversations, openConversation, type ConversationDetail } from "../../application/chat-service";
import { ChatThread } from "./chat-thread";
import { ConversationList } from "./conversation-list";

type Props = {
  actor: Actor;
  basePath: string;
  /** ?c=<conversa> */
  conversationParam?: string;
  /** ?com=<id da outra parte> */
  counterpartParam?: string;
};

/** Tela de mensagens (lista + conversa), igual para paciente e profissional. */
export async function MessagesScreen({ actor, basePath, conversationParam, counterpartParam }: Props) {
  let selectedId = conversationParam ?? null;
  if (!selectedId && counterpartParam) selectedId = await findConversationIdWith(actor, counterpartParam);

  let detail: ConversationDetail | null = null;
  if (selectedId) {
    try {
      detail = await openConversation(actor, selectedId);
    } catch (error) {
      if (!isDomainError(error)) throw error;
    }
  }

  // A lista é carregada depois de abrir a conversa, para já refletir a leitura.
  const conversations = await listConversations(actor);

  const tone = (): "violet" | "green" | "mist" => {
    if (!detail) return "violet";
    if (detail.counterpart.specialty) return detail.counterpart.specialty === "PSYCHIATRY" ? "green" : "violet";
    return detail.counterpart.preset === "ANONYMOUS" ? "mist" : "violet";
  };

  return (
    <div className="grid h-[calc(100dvh-9rem)] min-h-[28rem] overflow-hidden rounded-[1.25rem] border border-linha bg-papel lg:h-[calc(100dvh-14rem)] lg:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className={cn("min-h-0 overflow-y-auto border-linha lg:border-r", detail && "hidden lg:block")} aria-label="Conversas">
        {conversations.length > 0 ? (
          <ConversationList conversations={conversations} selectedId={detail?.id ?? null} basePath={basePath} />
        ) : (
          <div className="p-5">
            <EmptyState icon={<MessageCircle className="size-5" aria-hidden />} title="Nenhuma conversa ainda">
              {actor.role === "PATIENT"
                ? "A conversa com o profissional começa automaticamente quando você agenda uma consulta."
                : "As conversas aparecem quando um paciente agenda com você."}
            </EmptyState>
          </div>
        )}
      </aside>

      <section className={cn("min-h-0", !detail && "hidden lg:flex lg:items-center lg:justify-center")} aria-label="Conversa">
        {detail ? (
          <ChatThread
            key={detail.id}
            conversationId={detail.id}
            counterpart={{ ...detail.counterpart, tone: tone() }}
            initialMessages={detail.messages}
            backHref={basePath}
            readOnlyNotice={
              detail.counterpartActive
                ? null
                : actor.role === "PATIENT"
                  ? `${detail.counterpart.name} não atende mais pela clínica, então esta conversa ficou só para leitura. Para remarcar, escolha outro profissional em Agendar consulta ou fale com a clínica.`
                  : "Esta conta de paciente está desativada. A conversa ficou só para leitura."
            }
            headerAction={
              actor.role === "PROFESSIONAL" ? (
                <Link
                  href={`/profissional/pacientes/${detail.patientId}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-quaresmeira-700 hover:bg-quaresmeira-50"
                >
                  <ClipboardList className="size-4" aria-hidden />
                  <span className="hidden sm:inline">Ficha e prontuário</span>
                </Link>
              ) : null
            }
          />
        ) : (
          <p className="max-w-xs px-6 text-center text-pedra">Escolha uma conversa para ler e responder.</p>
        )}
      </section>
    </div>
  );
}
