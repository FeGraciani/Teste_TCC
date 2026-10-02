import { getCurrentActor } from "@/modules/identity/application/current-actor";
import { listMessagesSince } from "@/modules/messaging/application/chat-service";
import { isDomainError } from "@/shared/errors";

/**
 * Atualização automática do chat: mensagens a partir de ?depois=<ISO>.
 * Só participantes da conversa recebem resposta (validado no serviço).
 */
export async function GET(request: Request, context: RouteContext<"/api/conversas/[id]/mensagens">) {
  const actor = await getCurrentActor();
  if (!actor) return Response.json({ error: "Sessão expirada. Entre de novo." }, { status: 401 });

  const { id } = await context.params;
  const raw = new URL(request.url).searchParams.get("depois");
  const after = raw && !Number.isNaN(new Date(raw).getTime()) ? new Date(raw) : null;

  try {
    const messages = await listMessagesSince(actor, id, after);
    return Response.json({ messages }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (isDomainError(error)) return Response.json({ error: error.message }, { status: error.code === "NOT_FOUND" ? 404 : 403 });
    throw error;
  }
}
