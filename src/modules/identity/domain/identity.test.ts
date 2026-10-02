import { describe, expect, it } from "vitest";
import { decrypt, decryptJson, encrypt, encryptJson } from "@/shared/infrastructure/crypto";
import { hashPassword, passwordProblem, verifyPassword } from "./password";
import { safeRedirectPath } from "./roles";

describe("senhas", () => {
  it("gera hash verificável e rejeita senha errada", async () => {
    const hash = await hashPassword("Alento2026");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("Alento2026", hash)).toBe(true);
    expect(await verifyPassword("alento2026", hash)).toBe(false);
  });

  it("hashes da mesma senha são diferentes (sal aleatório)", async () => {
    expect(await hashPassword("Alento2026")).not.toBe(await hashPassword("Alento2026"));
  });

  it("regras de senha", () => {
    expect(passwordProblem("curta1")).toMatch(/8 caracteres/);
    expect(passwordProblem("somenteletras")).toMatch(/letras e números/);
    expect(passwordProblem("Alento2026")).toBeNull();
  });
});

describe("redirecionamento seguro após login", () => {
  it("aceita caminhos da própria área", () => {
    expect(safeRedirectPath("/paciente/agendar", "PATIENT")).toBe("/paciente/agendar");
  });

  it("bloqueia URLs externas e áreas de outros perfis", () => {
    expect(safeRedirectPath("https://golpe.com", "PATIENT")).toBe("/paciente");
    expect(safeRedirectPath("//golpe.com", "PATIENT")).toBe("/paciente");
    expect(safeRedirectPath("/admin", "PATIENT")).toBe("/paciente");
    expect(safeRedirectPath("/pacientex", "PATIENT")).toBe("/paciente");
  });
});

describe("criptografia em repouso", () => {
  it("criptografa e descriptografa", () => {
    const secret = "Paciente relata insônia há 3 semanas.";
    const payload = encrypt(secret);
    expect(payload).not.toContain("insônia");
    expect(payload.startsWith("v1.")).toBe(true);
    expect(decrypt(payload)).toBe(secret);
  });

  it("detecta adulteração", () => {
    const payload = encrypt("texto");
    const parts = payload.split(".");
    parts[3] = Buffer.from("outro").toString("base64url");
    expect(() => decrypt(parts.join("."))).toThrow();
  });

  it("JSON", () => {
    expect(decryptJson(encryptJson({ cpf: "123" }))).toEqual({ cpf: "123" });
    expect(decryptJson(null)).toBeNull();
  });
});
