/**
 * IP do cliente para limitar tentativas de login e registrar auditoria.
 *
 * Cada proxy da infraestrutura ACRESCENTA ao fim do X-Forwarded-For o IP de
 * quem falou com ele. As entradas mais à esquerda podem ter sido inventadas
 * pelo próprio cliente; por isso a entrada confiável é a N-ésima a partir do
 * fim, onde N é o número de proxies confiáveis na frente do app
 * (TRUSTED_PROXY_HOPS, padrão 1: um proxy reverso ou a própria hospedagem).
 */
export function trustedProxyHops(raw: string | undefined = process.env.TRUSTED_PROXY_HOPS): number {
  const value = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(value) && value >= 1 && value <= 10 ? value : 1;
}

export function clientIpFrom(headerList: Pick<Headers, "get">, hops: number = trustedProxyHops()): string | null {
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    const chain = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (chain.length > 0) return chain[Math.max(0, chain.length - hops)]!.slice(0, 64);
  }
  return headerList.get("x-real-ip")?.trim().slice(0, 64) || null;
}
