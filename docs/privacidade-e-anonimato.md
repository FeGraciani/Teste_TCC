# Privacidade e anonimato configurável

Este documento descreve o diferencial da clínica: **o paciente controla exatamente o que cada profissional vê**, enquanto o prontuário continua servindo à continuidade do cuidado.

## Princípios

1. **Os dados ocultos não saem do servidor.** O profissional recebe uma *projeção*: o valor permitido, uma versão parcial (ex.: "32 anos" em vez da data) ou o marcador `hidden`, sem conteúdo. A "névoa" da interface é um desenho com texto fictício.
2. **Falha segura.** Campo ausente ou inválido numa política vira o nível mais reservado (`sanitizeFields`). Paciente sem política nenhuma é tratado como anônimo.
3. **Uma única função decide.** `projectPatientForProfessional` (em `src/modules/privacy/domain/projection.ts`) é usada na ficha do profissional, na prévia do paciente e na demonstração do site. Não existe outro caminho para dados pessoais chegarem a um profissional.
4. **Busca sobre o nome já anonimizado.** A busca de pacientes do profissional filtra o nome exibido, então procurar um nome oculto não revela que ele existe.

## Campos e níveis

Definidos em `src/modules/privacy/domain/privacy-fields.ts` (a primeira opção é a mais aberta e a última, a mais reservada):

| Grupo | Campo | Níveis |
| --- | --- | --- |
| Identificação | Nome | Nome completo, primeiro nome (ou nome social), iniciais, codinome |
| | Data de nascimento | Data completa, só a idade, faixa etária, oculto |
| | Gênero e pronomes | Visível, oculto |
| | CPF | Visível, oculto |
| Contato e endereço | Telefone e e-mail | Visível, oculto |
| | Endereço | Completo, só cidade e estado, oculto |
| | Contato de emergência | Visível, oculto |
| Sobre você | Profissão, estado civil | Visível, oculto |
| Saúde | Motivo da busca, medicações, alergias, histórico | Visível, oculto |

Medicações e alergias exibem um alerta de segurança quando o paciente as oculta, porque pesam na escolha de qualquer medicamento.

## Modos prontos

| Modo | Resumo |
| --- | --- |
| Identificado | Tudo visível, como numa clínica tradicional |
| Discreto (padrão) | Primeiro nome, idade e cidade; documentos, contato e endereço ocultos |
| Anônimo | Codinome, faixa etária e só as informações de saúde essenciais |

Qualquer combinação diferente aparece como **Personalizado**.

## Política padrão, exceções e liberações

O que um profissional vê é calculado em três camadas (`resolvePolicy`, em `policy-store.ts`):

1. **Política padrão** do paciente (`privacy_policies.professional_id IS NULL`), que vale para todos.
2. **Exceção** daquele profissional, se o paciente criou uma (substitui a padrão por inteiro). Índices únicos parciais garantem no máximo uma política padrão e uma exceção por par paciente ↔ profissional.
3. **Liberações por pedido** (`privacy_field_grants`): campos que o paciente liberou para aquele profissional ao aprovar um pedido. Elas valem **por cima** das camadas anteriores, campo a campo, até o paciente revogar.

As listas (agenda, chat, pacientes) usam `resolveDisplayNames`, que aplica as mesmas três camadas ao nome.

## Pedidos de acesso

1. O profissional escolhe os campos que precisa e escreve o motivo (`requestFieldAccess`). Só é possível com vínculo de cuidado e um pedido pendente por vez.
2. O paciente recebe um aviso no chat e decide em **Privacidade**.
3. Se aprovar, cada campo pedido vira uma **liberação** só para aquele profissional (`respondToAccessRequest`). Nada é congelado: se o paciente deixar o padrão mais reservado depois, os demais dados acompanham a mudança e só os campos liberados continuam visíveis para quem pediu.
4. As liberações ficam listadas em **Privacidade → Dados liberados por pedido**, com data, e podem ser revogadas uma a uma ou todas de uma vez (`revokeFieldGrants`). O profissional é avisado pelo chat.
5. A prévia "o que este profissional vê" já inclui as liberações. Pedido, aprovação, recusa e revogação ficam na auditoria.

## Codinomes

Nomes de árvores e plantas brasileiras com um número (`Ipê-63`, `Jacarandá-27`), sorteados sem relação com a pessoa e únicos no banco. O paciente pode sortear outro a qualquer momento.

## Prontuário e anonimato

- O prontuário é ligado ao paciente pelo identificador interno; cada profissional o vê dentro da ficha que segue as preferências do paciente.
- O formulário de registro orienta a não escrever dados de identificação no texto, já que o prontuário segue para outros profissionais.
- Visibilidade de cada registro: **equipe do paciente** (qualquer profissional com vínculo), **mesma especialidade** ou **só o autor**. Notas de passagem de caso ficam fixadas no topo para o próximo profissional.
- O paciente **não vê o prontuário pelo app**, mas tem direito legal a uma cópia (LGPD, art. 18; Código de Ética Médica, art. 88; resoluções do CFP). A tela de privacidade explica isso e indica o canal de pedido.

## Quem vê o quê

| | Paciente | Profissional com vínculo | Profissional sem vínculo | Administração |
| --- | --- | --- | --- | --- |
| Cadastro completo | ✓ (o próprio) | Só o que o paciente liberou | ✗ | Nome e e-mail |
| Senha | Só a própria pessoa define (cadastro, convite ou link por e-mail) | Só a própria pessoa | — | **Nunca vê nem define**: só pede que um link seja enviado ao e-mail do dono da conta |
| Informações de saúde | ✓ | Só o que o paciente liberou | ✗ | ✗ |
| Prontuário | Cópia sob pedido formal | Conforme a visibilidade de cada registro | ✗ | ✗ |
| Mensagens | ✓ (as suas) | ✓ (as suas) | ✗ | ✗ |
| Quem acessou | ✓ | — | — | Trilha de auditoria (metadados) |
