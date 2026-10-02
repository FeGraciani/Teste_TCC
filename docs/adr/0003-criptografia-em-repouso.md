# ADR 0003 — Criptografia de dados sensíveis na aplicação

- **Status:** aceita
- **Data:** 2026-09-30

## Contexto

Prontuários, dados de saúde e mensagens são os dados mais sensíveis do sistema. A criptografia de disco do provedor não protege contra um dump do banco ou um acesso indevido com credenciais do banco.

## Decisão

Criptografar na aplicação, com AES-256-GCM (IV aleatório por registro e tag de autenticação), os campos: conteúdo do prontuário, mensagens do chat e o bloco `sensitive_data` do paciente (CPF, endereço, contato de emergência, motivo da busca, medicações, alergias e histórico). Formato versionado `v1.<iv>.<tag>.<cifra>`. A chave vem de `ENCRYPTION_KEY`.

## Consequências

- Um dump do banco não expõe conteúdo clínico.
- Esses campos não podem ser pesquisados por SQL (aceitável: buscas acontecem por identificadores e pelo nome exibido).
- A chave precisa de custódia rigorosa e backup; perdê-la torna os dados irrecuperáveis. O prefixo de versão permite rotação futura.
