<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Alento — orientações do projeto

Clínica de psicologia e psiquiatria com anonimato configurável pelo paciente. Interface e documentação em português do Brasil.

## Comandos

- `npm run check` — formatação (Prettier), lint, tipos e testes unitários (rode antes de concluir qualquer mudança); `npm run format` corrige a formatação
- `npm run test:integration` — testes com PostgreSQL real (`TEST_DATABASE_URL`, apagado a cada execução)
- `npm run test:e2e` — Playwright (exige `npm run build` e `npm run db:setup`)
- `npm run db:generate` depois de mudar um `schema.ts`; revise e faça commit da migração gerada

## Arquitetura

Monólito modular: `src/modules/<módulo>/{domain,application,infrastructure,presentation}`. Páginas em `src/app` são finas. Veja `docs/arquitetura.md`.

## Invariantes de privacidade (não quebre)

1. Dados pessoais de pacientes só chegam a profissionais por `projectPatientForProfessional` ou `resolveDisplayNames` (módulo `privacy`).
2. Pacientes e administração nunca leem o prontuário; profissionais só com vínculo de cuidado (`assertCareRelationship`).
3. Toda Server Action e Route Handler verifica sessão e perfil (`requireRole` / `getCurrentActor`); casos de uso recebem o `Actor` e validam o perfil de novo.
4. Prontuário, dados de saúde e mensagens são gravados com `encrypt()`; registros clínicos são imutáveis.
5. Acessos a perfil ou prontuário geram registro em `audit_logs`.
6. A administração nunca define nem vê senhas: contas criadas pela clínica recebem convite por e-mail e recuperação de senha é sempre por link enviado ao dono da conta (`account-access-service`).
7. Pedido de acesso aprovado vira liberação por campo (`privacy_field_grants`), aplicada por cima da política vigente e revogável; nunca copie a política para uma exceção.
8. E-mails não levam conteúdo clínico, especialidade nem motivo de consulta: só o necessário e um link para o app.
