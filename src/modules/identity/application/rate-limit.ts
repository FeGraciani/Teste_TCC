/**
 * Limitador simples de tentativas (memória do processo).
 * Suficiente para uma instância; em múltiplas instâncias, troque por Redis
 * (ver docs/arquitetura.md, "Próximos passos").
 */
type Bucket = { failures: number[] };

const buckets = new Map<string, Bucket>();

export type RateLimitOptions = { max: number; windowMs: number };

const MINUTE = 60 * 1000;

/** Login: por e-mail + IP (quem erra a senha algumas vezes espera um pouco). */
export const LOGIN_LIMIT: RateLimitOptions = { max: 5, windowMs: 15 * MINUTE };
/** Login: por CONTA, qualquer que seja o IP (barra quem troca de IP a cada tentativa). */
export const LOGIN_ACCOUNT_LIMIT: RateLimitOptions = { max: 10, windowMs: 15 * MINUTE };
/** "Esqueci minha senha": por e-mail e por IP (evita bombardear a caixa de alguém). */
export const PASSWORD_RESET_EMAIL_LIMIT: RateLimitOptions = { max: 3, windowMs: 60 * MINUTE };
export const PASSWORD_RESET_IP_LIMIT: RateLimitOptions = { max: 10, windowMs: 60 * MINUTE };

export const loginKeys = (email: string, ip: string | null) => ({
  pair: `login:${email}|${ip ?? "?"}`,
  account: `login-account:${email}`,
});

function prune(bucket: Bucket, now: number, windowMs: number) {
  bucket.failures = bucket.failures.filter((time) => now - time < windowMs);
}

export function isRateLimited(key: string, options: RateLimitOptions = LOGIN_LIMIT, now = Date.now()): boolean {
  const bucket = buckets.get(key);
  if (!bucket) return false;
  prune(bucket, now, options.windowMs);
  return bucket.failures.length >= options.max;
}

export function registerFailure(key: string, options: RateLimitOptions = LOGIN_LIMIT, now = Date.now()): void {
  const bucket = buckets.get(key) ?? { failures: [] };
  prune(bucket, now, options.windowMs);
  bucket.failures.push(now);
  buckets.set(key, bucket);
  if (buckets.size > 10_000) {
    // Evita crescimento indefinido de memória.
    const oldest = buckets.keys().next().value;
    if (oldest) buckets.delete(oldest);
  }
}

/** Conta um uso e diz se ainda estava dentro do limite (true = pode seguir). */
export function consumeRateLimit(key: string, options: RateLimitOptions, now = Date.now()): boolean {
  if (isRateLimited(key, options, now)) return false;
  registerFailure(key, options, now);
  return true;
}

export function clearFailures(key: string): void {
  buckets.delete(key);
}

/** Zera os bloqueios de login de uma conta (ex.: depois de redefinir a senha pelo link do e-mail). */
export function clearLoginFailuresFor(email: string): void {
  const normalized = email.trim().toLowerCase();
  const { account } = loginKeys(normalized, null);
  buckets.delete(account);
  const prefix = `login:${normalized}|`;
  for (const key of [...buckets.keys()]) if (key.startsWith(prefix)) buckets.delete(key);
}
