# ADR 0001 — Monólito modular em Next.js

- **Status:** aceita
- **Data:** 2026-09-30

## Contexto

A clínica precisa de site público, três áreas logadas, agenda, chat e prontuário, com uma equipe pequena para manter e um orçamento de hospedagem modesto. Ao mesmo tempo, regras de privacidade e de prontuário exigem fronteiras claras no código.

## Decisão

Um único app Next.js (App Router), organizado em módulos de negócio com camadas `domain`, `application`, `infrastructure` e `presentation`. As rotas são finas; a lógica fica nos módulos.

## Consequências

- Um deploy, um banco, uma linguagem: menos custo e menos peças para operar.
- Fronteiras explícitas permitem extrair um módulo (por exemplo, o chat) para um serviço próprio no futuro, se a escala pedir.
- Disciplina necessária: módulos se comunicam pela camada de aplicação, nunca acessando as tabelas uns dos outros diretamente fora do agregador de schema.
