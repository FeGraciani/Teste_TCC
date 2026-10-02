# Como contribuir

## Fluxo de trabalho

1. Crie um branch a partir de `main`: `feature/nome-curto`, `fix/nome-curto` ou `docs/nome-curto`.
2. Faça commits pequenos, com mensagens no imperativo (ex.: `Permite exceção de privacidade por profissional`).
3. Antes de abrir o pull request, rode `npm run format`, `npm run check` e `npm run test:integration`.
4. Preencha o checklist de privacidade do pull request.

## Onde colocar cada coisa

- Regra de negócio pura → `src/modules/<módulo>/domain` (com teste `*.test.ts` ao lado).
- Caso de uso (autorização, transação, auditoria) → `src/modules/<módulo>/application`.
- Tabela nova ou alterada → `src/modules/<módulo>/infrastructure/schema.ts`, depois `npm run db:generate` e commit da migração gerada.
- Server Action ou componente de tela → `src/modules/<módulo>/presentation`.
- Página → `src/app/...`, só compondo módulos.

## Regras de ouro

- Dados de paciente só chegam a profissionais pela projeção de privacidade.
- Toda entrada (formulário, URL, corpo de requisição) é validada com Zod ou com os guardas existentes (`isUuid`).
- Todo acesso a perfil ou prontuário de paciente gera um registro de auditoria.
- Ninguém além do dono da conta define ou vê uma senha. Fluxos de acesso usam links de uso único enviados ao e-mail da pessoa.
- E-mails não carregam conteúdo clínico: o detalhe fica no app, atrás do login.
- Textos da interface em português claro, voz ativa e sem jargão.
