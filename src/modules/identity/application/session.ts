import "server-only";
import { and, eq, lt, ne } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { randomToken, sha256 } from "@/shared/infrastructure/crypto";
import { db } from "@/shared/infrastructure/database/client";
import { isProduction } from "@/shared/infrastructure/env";
import { clientIpFrom } from "../domain/client-ip";
import { SESSION_COOKIE } from "../domain/session-cookie";
import { sessions } from "../infrastructure/schema";

export { SESSION_COOKIE, clientIpFrom };

/**
 * Sessões opacas guardadas no banco:
 *  - o cookie carrega um token aleatório de 256 bits (httpOnly, SameSite=Lax);
 *  - o banco guarda só o SHA-256 do token;
 *  - a validade desliza: cada uso renova por mais 7 dias;
 *  - logout, troca de senha ou desativação revogam na hora.
 */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const RENEW_WHEN_REMAINING_MS = SESSION_TTL_MS - 24 * 60 * 60 * 1000;

export async function requestIp(): Promise<string | null> {
  return clientIpFrom(await headers());
}

export async function createSession(userId: string): Promise<void> {
  const token = randomToken(32);
  const headerList = await headers();
  await db.insert(sessions).values({
    tokenHash: sha256(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    userAgent: headerList.get("user-agent")?.slice(0, 300) ?? null,
    ipAddress: clientIpFrom(headerList),
  });
  // Limpeza oportunista de sessões expiradas deste usuário.
  await db.delete(sessions).where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, new Date())));

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export async function readSessionTokenHash(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? sha256(token) : null;
}

/** Renova a validade no banco quando a sessão já foi usada por mais de um dia. */
export async function touchSession(sessionId: string, expiresAt: Date): Promise<void> {
  if (expiresAt.getTime() - Date.now() < RENEW_WHEN_REMAINING_MS) {
    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() + SESSION_TTL_MS) })
      .where(eq(sessions.id, sessionId));
  }
}

export async function destroyCurrentSession(): Promise<void> {
  const tokenHash = await readSessionTokenHash();
  if (tokenHash) await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  (await cookies()).delete(SESSION_COOKIE);
}

export async function destroyAllSessionsOf(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/**
 * Encerra todas as sessões do usuário, menos a atual (ex.: após trocar a senha).
 * @param keepTokenHash sessão a manter; se omitido, usa a do cookie da requisição.
 */
export async function destroyOtherSessionsOf(userId: string, keepTokenHash?: string | null): Promise<void> {
  const keep = keepTokenHash === undefined ? await readSessionTokenHash() : keepTokenHash;
  await db.delete(sessions).where(keep ? and(eq(sessions.userId, userId), ne(sessions.tokenHash, keep)) : eq(sessions.userId, userId));
}
