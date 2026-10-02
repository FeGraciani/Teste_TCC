# ADR 0006 — Pedidos de acesso viram liberações por campo, revogáveis

- **Status:** aceita
- **Data:** 2026-10-02

## Contexto

Quando o paciente aprovava um pedido de acesso (ex.: CPF para uma receita de controle especial), a primeira versão copiava a política vigente para uma **exceção** daquele profissional, com os campos pedidos liberados. A exceção ficava congelada: se o paciente depois mudasse o padrão para Anônimo, aquele profissional continuava vendo nome, idade, cidade e tudo o mais da época, sem que a tela de aprovação tivesse avisado que uma exceção completa tinha sido criada.

## Decisão

- Aprovar um pedido cria uma **liberação por campo** (`privacy_field_grants`): um registro por dado liberado, só para aquele profissional.
- O que o profissional vê = padrão (ou exceção, se o paciente criou uma) **+** liberações ativas, aplicadas por cima, campo a campo.
- As liberações ficam listadas em **Privacidade → Dados liberados por pedido** e podem ser revogadas uma a uma ou todas; o profissional é avisado pelo chat e a revogação vai para a auditoria.
- Índice único parcial impede liberações duplicadas ativas; a migração converteu pedidos já aprovados em liberações explícitas.

## Consequências

- Mudar o padrão nunca "esquece" o que foi liberado, e nunca "congela" o que não foi: o paciente vê exatamente o estado de cada profissional na prévia.
- Exceções criadas pelo próprio paciente continuam existindo e funcionando como antes.
