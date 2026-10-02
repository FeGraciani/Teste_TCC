# ADR 0005 — Convites e nova senha por links de uso único enviados por e-mail

- **Status:** aceita (substitui as senhas provisórias geradas pela administração)
- **Data:** 2026-10-02

## Contexto

Na primeira versão, a administração cadastrava profissionais com uma senha provisória e podia gerar uma nova senha provisória para qualquer conta. Uma revisão de segurança mostrou o problema: quem tem acesso à administração (ex.: recepção) podia gerar a senha de uma psiquiatra, entrar como ela e ler os prontuários dos pacientes dela, e a trilha de acessos do paciente mostraria o nome da psiquiatra, não o de quem entrou. Isso quebrava a promessa central do produto: a administração não lê prontuários.

## Decisão

- A senha é sempre escolhida pelo dono da conta.
- Contas criadas pela clínica (profissionais e equipe administrativa) nascem sem senha utilizável (`password_set_at` nulo) e recebem um **convite** por e-mail (link de uso único, 7 dias).
- "Esqueci minha senha" e o botão "Enviar link de nova senha" da administração geram um **link de redefinição** (uso único, 2 horas) enviado só para o e-mail da pessoa. A senha atual continua valendo até ela trocar.
- O banco guarda apenas o SHA-256 do token (`account_tokens`); um link novo invalida os anteriores; usar o link encerra todas as sessões da conta e dispara um e-mail de "senha alterada".
- "Esqueci minha senha" responde sempre a mesma coisa e faz o trabalho depois da resposta (`after`), para que nem a mensagem nem o tempo revelem se o e-mail tem conta.
- Sem SMTP configurado: em desenvolvimento (`next dev`), o e-mail aparece no terminal e a administração vê o link para testar; em produção, nada é enviado, nada vai para os logs e a tela avisa que é preciso configurar o envio.

## Consequências

- Produção exige um provedor de e-mail (`SMTP_URL`, `MAIL_FROM`). O servidor avisa na inicialização quando falta.
- Quem controla a caixa de e-mail de alguém controla a conta, como em qualquer serviço com recuperação por e-mail. Para profissionais, recomenda-se e-mail institucional com verificação em duas etapas.
- O primeiro administrador continua sendo criado pela linha de comando (`npm run admin:create`), por quem faz o deploy.
