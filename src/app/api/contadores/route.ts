import { getCurrentActor } from "@/modules/identity/application/current-actor";
import { loadNavCounters } from "@/app/_lib/nav-counters";

/** Contadores do menu (mensagens não lidas, pedidos pendentes) da pessoa logada. */
export async function GET() {
  const actor = await getCurrentActor();
  if (!actor) return Response.json({ error: "Sessão expirada." }, { status: 401 });
  return Response.json(await loadNavCounters(actor), { headers: { "Cache-Control": "private, no-store" } });
}
