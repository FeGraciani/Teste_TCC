# Arquitetura

## Visão geral

O Alento é um **monólito modular** em Next.js 16 (App Router). Um único deploy serve o site público, as três áreas logadas e as rotas HTTP, mas o código é dividido em **módulos de negócio** independentes, cada um com quatro camadas:

| Camada | Pasta | Pode depender de | Exemplo |
| --- | --- | --- | --- |
| Domínio | `modules/<m>/domain` | só código puro | `projection.ts` (o que o profissional vê), `availability.ts` (horários livres) |
| Aplicação | `modules/<m>/application` | domínio, infraestrutura, outros módulos (aplicação) | `booking-service.ts` (agendar com trava e auditoria) |
| Infraestrutura | `modules/<m>/infrastructure` | Drizzle | `schema.ts` (tabelas do módulo) |
| Apresentação | `modules/<m>/presentation` | aplicação, `shared/ui` | `actions.ts` (Server Actions), `components/` |

As rotas em `src/app` são finas: autenticam (`requireRole`), chamam casos de uso e compõem componentes dos módulos.

Regras que mantêm a organização:

- **O domínio é puro.** Sem banco, sem Next.js, sem Node. Por isso a mesma função de projeção de privacidade roda no servidor (filtrando dados) e no navegador (prévia ao vivo do paciente), e as regras são testadas em milissegundos.
- **Todo caso de uso recebe o `Actor` explicitamente** (quem está agindo e com qual perfil). Nada depende de estado global, o que permite testar a autorização sem servidor HTTP.
- **Autorização mora na camada de aplicação**, perto dos dados (`assertPatient`, `assertProfessional`, `assertCareRelationship`). O `proxy.ts` faz só uma checagem otimista do cookie para redirecionar rápido.
- **Cada módulo é dono das suas tabelas.** `shared/infrastructure/database/schema.ts` apenas agrega os schemas para o cliente do Drizzle.

## Módulos

| Módulo | Responsabilidade |
| --- | --- |
| `identity` | Contas, sessões, perfis de paciente e profissional, portais de entrada, troca de senha, convites e links de nova senha por e-mail |
| `privacy` | Catálogo de campos e níveis, modos prontos, exceções por profissional, projeção, pedidos de acesso e liberações por campo, codinomes |
| `scheduling` | Grade semanal, regras da agenda, ausências, cálculo de horários livres, agendamento, cancelamento, vínculo de cuidado |
| `clinical-records` | Prontuário (imutável e criptografado) e regras de leitura por visibilidade |
| `messaging` | Conversas paciente ↔ profissional, avisos automáticos, contagem de não lidas |
| `catalog` | Serviços, durações e valores (exibidos no site) |
| `administration` | Indicadores, gestão de profissionais, pacientes e administradores (convites e links de acesso, nunca senhas) |
| `audit` | Trilha de auditoria e o "quem acessou meus dados" do paciente |

## Fluxos importantes

### Agendamento sem choque de horário

1. A tela mostra só horários calculados por `computeAvailableSlots` (função pura): grade de atendimento, duração do serviço, intervalo entre sessões, antecedência mínima, janela de agendamento, ausências e consultas existentes, tudo no fuso `America/Sao_Paulo`.
2. Ao confirmar, `bookAppointment` abre uma transação, **trava a linha do profissional** (`SELECT … FOR UPDATE`), recalcula os horários livres e confere se o horário escolhido continua entre eles. Horários inventados ou já ocupados são recusados.
3. O PostgreSQL ainda garante, com restrições `EXCLUDE USING gist`, que nenhum profissional nem paciente fique com duas consultas agendadas sobrepostas (defesa em profundidade).

### O que o profissional vê de um paciente

`getPatientProfileForProfessional` exige vínculo de cuidado (consulta agendada, realizada ou com falta; consultas canceladas não contam), resolve a política vigente (a exceção daquele profissional ou a padrão), aplica `projectPatientForProfessional` e registra o acesso na auditoria. Listas (agenda, chat, pacientes) usam `resolveDisplayNames`, que devolve só o nome permitido. Veja [privacidade-e-anonimato.md](privacidade-e-anonimato.md).

### Prontuário para o próximo profissional

`addClinicalRecord` grava o conteúdo criptografado; `getPatientChart` só existe para profissionais com vínculo e aplica `canReadRecord` a cada registro (equipe do paciente, mesma especialidade ou só o autor). Não há caminho de leitura para pacientes ou administração. Um trigger no banco impede `UPDATE` e `DELETE` do conteúdo.

### Chat

Uma conversa por par paciente ↔ profissional, criada no primeiro agendamento. Mensagens são enviadas por Server Action e atualizadas por *polling* leve (`GET /api/conversas/:id/mensagens?depois=…`, a cada 4 s), que funciona em qualquer hospedagem, inclusive serverless. Cancelamentos, agendamentos e pedidos de acesso geram avisos automáticos (`SYSTEM`).

### E-mails transacionais

`shared/infrastructure/email` envia por SMTP (`SMTP_URL`) com um modelo único em HTML e texto. Os módulos montam o próprio conteúdo: convites e nova senha em `identity/application/account-emails.ts`, aviso de cancelamento em `scheduling/application/appointment-emails.ts`. Os envios que não precisam bloquear a resposta usam `afterResponse` (o `after` do Next.js), e falhas do provedor nunca derrubam a ação principal: o aviso oficial continua no chat do app.

## Banco de dados

PostgreSQL 16 com migrações versionadas em `drizzle/`. Além das tabelas, a migração `0001_integrity_rules.sql` cria regras que valem mesmo se a aplicação falhar:

- `EXCLUDE` contra sobreposição de consultas (por profissional e por paciente);
- `CHECK` de coerência (fim depois do início, valores e minutos válidos);
- trigger que torna o prontuário imutável.

A `0002_account_links_grants_author_specialty.sql` acrescenta os links de acesso, as liberações por campo, a especialidade do autor gravada em cada registro clínico e um trigger que bloqueia `TRUNCATE` do prontuário (só o reset dos dados de demonstração e dos testes liga, dentro da própria transação, a chave `alento.permitir_reset_demo`).

Para mudar o schema: altere o `schema.ts` do módulo, rode `npm run db:generate`, revise o SQL gerado e faça commit da migração.

## Próximos passos sugeridos

- **Várias instâncias**: trocar o limitador de tentativas de login (memória) por Redis e definir `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`.
- **Fila de e-mails**: hoje os e-mails saem logo após a resposta; com volume maior, vale uma fila com novas tentativas.
- **Lembretes** de consulta por e-mail ou WhatsApp, usando a mesma fila.
- **Verificação em duas etapas** para profissionais e administração.
- **Rotação da chave de criptografia**: o formato `v1.` dos dados cifrados já permite introduzir `v2` com outra chave.
