# LGPD e segurança

Dados de saúde mental são **dados pessoais sensíveis** (LGPD, art. 5º, II). Este documento resume as medidas técnicas do sistema e o que a clínica precisa cuidar na operação.

## Medidas técnicas

| Tema | Como o sistema trata |
| --- | --- |
| Senhas | Hash scrypt com sal aleatório; comparação em tempo constante; mesma latência para e-mail inexistente (evita descobrir quem é paciente) |
| Quem define a senha | **Sempre o dono da conta.** Profissionais e equipe administrativa recebem um convite por e-mail (link de uso único, 7 dias); "Esqueci minha senha" e o botão da administração enviam um link de redefinição (uso único, 2 horas) **só para o e-mail da pessoa**. A administração nunca vê nem define senhas, então não consegue entrar como um profissional para ler prontuários. O banco guarda só o SHA-256 dos links |
| Avisos de segurança | E-mail ao dono da conta quando a senha é trocada ou redefinida; todas as sessões abertas são encerradas na redefinição |
| Sessões | Token aleatório de 256 bits em cookie `httpOnly` e `SameSite=Lax` (`Secure` em produção); o banco guarda só o SHA-256; validade deslizante de 7 dias; logout, troca de senha e desativação encerram sessões |
| Força bruta | 5 tentativas por e-mail e IP **e** 10 por conta (qualquer IP) a cada 15 minutos; "esqueci minha senha" limitado por e-mail e por IP, com resposta idêntica exista ou não a conta. O IP vem do proxy confiável (`TRUSTED_PROXY_HOPS`), não do que o cliente declara |
| Autorização | Perfil verificado em toda página, Server Action e rota HTTP; vínculo de cuidado para qualquer dado de paciente; portais separados para paciente, profissional e administração |
| Criptografia em repouso | AES-256-GCM (com autenticação) para prontuários, dados de saúde, CPF, endereço, contato de emergência e mensagens |
| Integridade | Prontuário imutável (triggers no banco bloqueiam `UPDATE`, `DELETE` e `TRUNCATE`, inclusive em cascata); a especialidade do autor fica gravada no registro; restrições contra choque de horários; registros clínicos nunca são apagados |
| Dados de demonstração | O `npm run db:seed` se recusa a rodar em produção, em banco que não seja local (sem `SEED_ALLOW_REMOTE=true`) e em banco com contas reais |
| E-mails | Discretos por padrão: não citam profissional, especialidade nem motivo. O detalhe fica no app, atrás do login. Sem `SMTP_URL` em produção, nada é enviado e nenhum link vai para os logs |
| Minimização | O profissional recebe só a projeção permitida; a administração não acessa conteúdo clínico |
| Auditoria | Logins (e falhas), acessos a perfil e prontuário, agendamentos, cancelamentos, mudanças de privacidade e ações administrativas, sem conteúdo clínico |
| Transporte e navegador | HSTS em produção, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`; áreas logadas com `Cache-Control: no-store` e `noindex` |
| CSRF | Server Actions só aceitam requisições da mesma origem; cookie `SameSite=Lax` |

## Bases legais (resumo)

- Atendimento e prontuário: tutela da saúde (art. 11, II, "f") e obrigação legal de manter o prontuário (art. 11, II, "a").
- Agenda, cobrança e recibos: execução de contrato (art. 7º, V).
- Segurança e auditoria: art. 7º, IX, e art. 11, II, "g".

## Retenção

O prontuário deve ser guardado por **no mínimo 20 anos** a partir do último registro (Lei nº 13.787/2018). Por isso registros clínicos não podem ser apagados pelo sistema, nem mesmo a pedido. Os demais dados podem ser anonimizados quando a conta for encerrada, respeitando prazos fiscais.

## Direitos do titular

A tela de privacidade mostra ao paciente quem acessou seus dados e indica o canal para pedir **cópia do prontuário** e exercer os demais direitos do art. 18. A clínica deve responder em até 15 dias.

## Responsabilidades da clínica (operação)

- Nomear o encarregado (DPO) e publicar o contato dele.
- Guardar a `ENCRYPTION_KEY` em cofre de segredos, com backup separado do backup do banco.
- Configurar o envio de e-mails (`SMTP_URL`, `MAIL_FROM`) com domínio autenticado (SPF, DKIM e DMARC), para que convites e links de nova senha não caiam no spam.
- Usar no banco de produção um usuário da aplicação sem permissão de DDL (`DROP`, `ALTER`), deixando as migrações para um usuário separado.
- Fazer backup criptografado do banco e testar a restauração.
- Conceder acesso administrativo só a quem precisa e revisar a trilha de auditoria periodicamente.
- Ter um plano de resposta a incidentes e comunicar a ANPD e os titulares quando exigido (art. 48).
- Revisar a política de privacidade e os termos de uso com a assessoria jurídica antes de publicar.
