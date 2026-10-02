import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

/**
 * Hash de senhas com scrypt (nativo do Node, resistente a força bruta).
 * Formato armazenado: scrypt$N$r$p$sal$hash (base64url).
 */

const KEY_LENGTH = 64;
const COST = 16384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;

function scrypt(password: string, salt: Buffer, cost: number, blockSize: number, parallelization: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password.normalize("NFKC"),
      salt,
      KEY_LENGTH,
      { N: cost, r: blockSize, p: parallelization, maxmem: 64 * 1024 * 1024 },
      (error, derived) => (error ? reject(error) : resolve(derived)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, COST, BLOCK_SIZE, PARALLELIZATION);
  return ["scrypt", COST, BLOCK_SIZE, PARALLELIZATION, salt.toString("base64url"), derived.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, cost, blockSize, parallelization, salt, hash] = stored.split("$");
  if (algorithm !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const derived = await scrypt(password, Buffer.from(salt, "base64url"), Number(cost), Number(blockSize), Number(parallelization));
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/** Hash usado para igualar o tempo de resposta quando o e-mail não existe. */
export const DUMMY_PASSWORD_HASH =
  "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export const PASSWORD_MIN_LENGTH = 8;

/** Regras de senha em português. Retorna o problema ou null. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  if (!/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) return "Use letras e números na senha.";
  if (password.length > 200) return "A senha é longa demais.";
  return null;
}
