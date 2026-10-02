import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/modules/identity/domain/session-cookie";

/**
 * Checagem OTIMISTA de acesso às áreas logadas: sem o cookie de sessão,
 * a pessoa vai direto para a tela de entrada do portal certo.
 *
 * A verificação AUTORITATIVA (sessão válida no banco, perfil correto,
 * conta ativa) acontece em cada página e Server Action, pela camada de
 * acesso a dados (getCurrentActor / requireRole). O proxy não consulta o banco.
 */
const PROTECTED_AREAS = [
  { prefix: "/paciente", portal: null },
  { prefix: "/profissional", portal: "profissional" },
  { prefix: "/admin", portal: "administracao" },
] as const;

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const area = PROTECTED_AREAS.find((item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`));

  if (area && !request.cookies.has(SESSION_COOKIE)) {
    const url = new URL("/entrar", request.url);
    if (area.portal) url.searchParams.set("perfil", area.portal);
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/paciente/:path*", "/profissional/:path*", "/admin/:path*"],
};
