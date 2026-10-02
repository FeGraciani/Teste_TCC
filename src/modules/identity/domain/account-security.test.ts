import { describe, expect, it } from "vitest";
import { LOGIN_ACCOUNT_LIMIT, clearLoginFailuresFor, consumeRateLimit, isRateLimited, loginKeys, registerFailure } from "../application/rate-limit";
import { ACCOUNT_LINK_TTL_MS, accountLinkState, firstNameOf, maskEmail } from "./account-links";
import { clientIpFrom, trustedProxyHops } from "./client-ip";
import { isPortalKey, portalOfRole } from "./portals";

const headers = (values: Record<string, string>) => new Headers(values);

describe("links de acesso por e-mail", () => {
  const now = new Date("2030-03-04T12:00:00Z");

  it("valem até expirar e só uma vez", () => {
    expect(accountLinkState({ expiresAt: new Date(now.getTime() + 1000), usedAt: null }, now)).toBe("valid");
    expect(accountLinkState({ expiresAt: now, usedAt: null }, now)).toBe("expired");
    expect(accountLinkState({ expiresAt: new Date(now.getTime() + 1000), usedAt: now }, now)).toBe("used");
  });

  it("convite dura mais que redefinição de senha", () => {
    expect(ACCOUNT_LINK_TTL_MS.INVITE).toBeGreaterThan(ACCOUNT_LINK_TTL_MS.PASSWORD_RESET);
    expect(ACCOUNT_LINK_TTL_MS.PASSWORD_RESET).toBeLessThanOrEqual(2 * 60 * 60 * 1000);
  });

  it("mostra o e-mail só o suficiente para a pessoa reconhecer", () => {
    expect(maskEmail("helena@clinica.com.br")).toBe("h•••••@clinica.com.br");
    expect(maskEmail("ab@x.com")).toBe("a•••@x.com");
    expect(maskEmail("invalido")).toBe("•••");
    expect(firstNameOf("  Helena Duarte Ribeiro ")).toBe("Helena");
  });
});

describe("IP do cliente atrás de proxy", () => {
  it("usa a entrada acrescentada pelo proxy confiável, não a que o cliente inventou", () => {
    const spoofed = headers({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" });
    expect(clientIpFrom(spoofed, 1)).toBe("203.0.113.9");
    expect(clientIpFrom(headers({ "x-forwarded-for": "1.2.3.4, 203.0.113.9, 10.0.0.2" }), 2)).toBe("203.0.113.9");
    expect(clientIpFrom(headers({ "x-forwarded-for": "203.0.113.9" }), 3)).toBe("203.0.113.9");
    expect(clientIpFrom(headers({ "x-real-ip": "198.51.100.1" }))).toBe("198.51.100.1");
    expect(clientIpFrom(headers({}))).toBeNull();
  });

  it("TRUSTED_PROXY_HOPS inválido volta ao padrão 1", () => {
    expect(trustedProxyHops("2")).toBe(2);
    expect(trustedProxyHops("0")).toBe(1);
    expect(trustedProxyHops("abc")).toBe(1);
    expect(trustedProxyHops(undefined)).toBe(1);
  });
});

describe("limite de tentativas", () => {
  it("por conta: bloqueia mesmo trocando de IP, e a nova senha libera", () => {
    const email = `conta-${Date.now()}@teste.example`;
    for (let attempt = 0; attempt < LOGIN_ACCOUNT_LIMIT.max; attempt += 1) {
      registerFailure(loginKeys(email, `10.0.0.${attempt}`).account, LOGIN_ACCOUNT_LIMIT);
    }
    expect(isRateLimited(loginKeys(email, "10.9.9.9").account, LOGIN_ACCOUNT_LIMIT)).toBe(true);
    clearLoginFailuresFor(email.toUpperCase());
    expect(isRateLimited(loginKeys(email, "10.9.9.9").account, LOGIN_ACCOUNT_LIMIT)).toBe(false);
  });

  it("consumeRateLimit conta o uso e recusa depois do máximo", () => {
    const key = `uso-${Date.now()}`;
    const limit = { max: 2, windowMs: 60_000 };
    expect(consumeRateLimit(key, limit)).toBe(true);
    expect(consumeRateLimit(key, limit)).toBe(true);
    expect(consumeRateLimit(key, limit)).toBe(false);
    expect(consumeRateLimit(key, limit, Date.now() + 61_000)).toBe(true);
  });
});

describe("portais de entrada", () => {
  it("só aceita os três portais (nada de propriedades herdadas)", () => {
    expect(isPortalKey("profissional")).toBe(true);
    expect(isPortalKey("toString")).toBe(false);
    expect(isPortalKey("constructor")).toBe(false);
    expect(isPortalKey("__proto__")).toBe(false);
  });

  it("cada perfil tem o seu portal", () => {
    expect(portalOfRole("PATIENT")).toBe("paciente");
    expect(portalOfRole("PROFESSIONAL")).toBe("profissional");
    expect(portalOfRole("ADMIN")).toBe("administracao");
  });
});
