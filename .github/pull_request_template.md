## O que muda

<!-- Descreva a mudança do ponto de vista de quem usa: paciente, profissional ou administração. -->

## Como testar

<!-- Passos para conferir manualmente, com a conta de demonstração usada. -->

## Checklist de privacidade

- [ ] Nenhum dado pessoal ou clínico novo sai do servidor sem passar pela projeção de privacidade (`projectPatientForProfessional` / `resolveDisplayNames`).
- [ ] Toda Server Action e Route Handler nova verifica sessão e perfil (`requireRole` / `getCurrentActor`).
- [ ] Acessos a dados de pacientes são registrados na auditoria.
- [ ] Nenhuma tela ou ação permite que alguém defina ou veja a senha de outra pessoa.
- [ ] E-mails novos não levam conteúdo clínico, especialidade nem motivo de consulta.
- [ ] `npm run check` (formatação, lint, tipos e unitários) e `npm run test:integration` passam.
