import "server-only";
import { countUnreadMessages } from "@/modules/messaging/application/chat-service";
import { countPendingAccessRequests } from "@/modules/privacy/application/privacy-service";
import type { Actor } from "@/shared/application/actor";
import type { NavCounters } from "@/shared/ui/counters-provider";

/** Números exibidos ao lado dos itens do menu de cada perfil. */
export async function loadNavCounters(actor: Actor): Promise<NavCounters> {
  if (actor.role === "ADMIN") return {};
  const unreadMessages = await countUnreadMessages(actor);
  if (actor.role === "PATIENT") {
    return { unreadMessages, pendingRequests: await countPendingAccessRequests(actor) };
  }
  return { unreadMessages };
}
