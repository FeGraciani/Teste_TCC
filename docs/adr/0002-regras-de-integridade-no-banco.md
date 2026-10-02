# ADR 0002 — Regras críticas também no PostgreSQL

- **Status:** aceita
- **Data:** 2026-09-30

## Contexto

Duas falhas seriam graves: dois pacientes no mesmo horário de um profissional e a alteração ou exclusão de um registro de prontuário.

## Decisão

Além das validações da aplicação, o banco aplica:

- `EXCLUDE USING gist` (extensão `btree_gist`) sobre `tstzrange(starts_at, ends_at)` para consultas agendadas, por profissional e por paciente;
- trigger que bloqueia `UPDATE` do conteúdo e `DELETE` em `clinical_records`;
- `CHECK` de coerência em horários e valores.

O agendamento também trava a linha do profissional (`SELECT … FOR UPDATE`) e recalcula os horários livres dentro da transação.

## Consequências

- Garantias valem mesmo com bugs, scripts manuais ou acessos diretos ao banco.
- Exige PostgreSQL com `btree_gist`, disponível nos principais provedores gerenciados.
- Correções no prontuário são feitas com uma nova anotação, como pedem as boas práticas de documentação clínica.
