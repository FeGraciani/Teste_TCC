# ADR 0004 — Sessões opacas guardadas no banco

- **Status:** aceita
- **Data:** 2026-09-30

## Contexto

Profissionais e administradores podem precisar perder o acesso imediatamente (desligamento, suspeita de invasão). Tokens JWT sem estado continuam válidos até expirar.

## Decisão

Sessões com token aleatório de 256 bits em cookie `httpOnly`; o banco guarda apenas o SHA-256 do token. Cada requisição autenticada consulta a sessão e verifica se a conta está ativa. Logout, troca de senha e desativação apagam as sessões.

## Consequências

- Revogação instantânea e auditável.
- Uma consulta ao banco por requisição autenticada (barata, com índice único).
- O `proxy.ts` só confere a presença do cookie, sem acessar o banco; a verificação real fica na camada de acesso a dados.
