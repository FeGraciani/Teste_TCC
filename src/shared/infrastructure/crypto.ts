import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { encryptionKey } from "./env";

/**
 * Criptografia em repouso para dados sensíveis (prontuários, dados clínicos
 * do paciente e mensagens). AES-256-GCM com IV aleatório por registro.
 *
 * Formato: v1.<iv>.<authTag>.<cifra>  (base64url)
 * O prefixo de versão permite rotacionar a chave no futuro.
 */
const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";

export function encrypt(plainText: string, key: Buffer = encryptionKey()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const cipherText = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), authTag.toString("base64url"), cipherText.toString("base64url")].join(".");
}

export function decrypt(payload: string, key: Buffer = encryptionKey()): string {
  const [version, iv, authTag, cipherText] = payload.split(".");
  if (version !== VERSION || !iv || !authTag || cipherText === undefined) {
    throw new Error("Formato de dado criptografado desconhecido.");
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(authTag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(cipherText, "base64url")), decipher.final()]).toString("utf8");
}

export function encryptJson(value: unknown, key?: Buffer): string {
  return encrypt(JSON.stringify(value), key);
}

export function decryptJson<T>(payload: string | null | undefined, key?: Buffer): T | null {
  if (!payload) return null;
  return JSON.parse(decrypt(payload, key)) as T;
}

/** Hash não reversível (tokens de sessão). */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
