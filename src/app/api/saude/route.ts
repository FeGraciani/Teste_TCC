import { sql } from "drizzle-orm";
import { db } from "@/shared/infrastructure/database/client";

/** Verificação de saúde para a hospedagem (load balancer, uptime): aplicação + banco. */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "erro", detalhe: "Banco de dados indisponível" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
