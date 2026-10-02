import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { LegalDocument } from "../_components/legal-document";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Como a Alento trata seus dados pessoais e dados de saúde, de acordo com a LGPD.",
};

/*
 * Texto-base alinhado à LGPD (Lei nº 13.709/2018). Antes de publicar,
 * revise com a assessoria jurídica da clínica e preencha os dados reais
 * do controlador e do encarregado (DPO) em src/config/site.ts.
 */
export default function PrivacyPolicyPage() {
  const { legalName, cnpj, contact, address } = siteConfig;
  return (
    <LegalDocument title="Política de privacidade" updatedAt="1º de outubro de 2026">
      <p>
        Esta política explica como a {legalName} (“Alento”, “clínica”), CNPJ {cnpj}, trata seus dados pessoais quando você usa nosso site e nosso
        aplicativo. Ela foi escrita para ser lida por pessoas, não só por advogados. Se algo não ficar claro, escreva para{" "}
        <a href={`mailto:${contact.email}`}>{contact.email}</a>.
      </p>

      <h2>1. Quem é responsável pelos seus dados</h2>
      <p>
        A Alento é a controladora dos dados, com sede na {address.street}, {address.district}, {address.city}/{address.state}. O encarregado pelo
        tratamento de dados (DPO) pode ser contatado pelo e-mail <a href={`mailto:${contact.email}`}>{contact.email}</a>.
      </p>

      <h2>2. Quais dados tratamos</h2>
      <ul>
        <li>
          <strong>Cadastro:</strong> nome, e-mail, data de nascimento e senha (guardada apenas em forma de hash, nunca em texto).
        </li>
        <li>
          <strong>Dados pessoais complementares que você decide informar:</strong> nome social ou apelido, gênero e pronomes, telefone, cidade,
          profissão, estado civil, CPF, endereço e contato de emergência.
        </li>
        <li>
          <strong>Dados de saúde que você decide informar:</strong> o motivo da busca por atendimento, medicações, alergias e histórico de saúde.
        </li>
        <li>
          <strong>Dados do atendimento:</strong> consultas agendadas, mensagens trocadas com os profissionais e o prontuário, registrado pelos
          profissionais que atendem você.
        </li>
        <li>
          <strong>Dados técnicos:</strong> endereço IP, navegador e data e hora de acessos, usados para segurança e para a trilha de auditoria.
        </li>
      </ul>

      <h2>3. Para que usamos e com qual base legal</h2>
      <ul>
        <li>
          Prestar o atendimento psicológico e psiquiátrico e manter o prontuário: tutela da saúde (LGPD, art. 11, II, “f”) e cumprimento de obrigação
          legal (art. 11, II, “a”).
        </li>
        <li>Agendar, cancelar e cobrar consultas, e emitir recibos: execução de contrato (art. 7º, V).</li>
        <li>
          Enviar e-mails de serviço (convite de acesso, link para criar nova senha, aviso de senha alterada e de consulta cancelada): execução de
          contrato e segurança da sua conta. Esses e-mails não trazem informações clínicas, o nome do profissional nem o motivo da consulta.
        </li>
        <li>Registrar acessos e prevenir fraudes: legítimo interesse e segurança do titular (art. 7º, IX, e art. 11, II, “g”).</li>
        <li>Mostrar a cada profissional apenas os dados que você liberou: cumprimento das suas próprias escolhas de privacidade.</li>
      </ul>
      <p>Não vendemos dados, não usamos seus dados para publicidade e não os compartilhamos com empresas parceiras para fins comerciais.</p>

      <h2>4. O anonimato configurável</h2>
      <p>
        Você decide, em “Privacidade”, o que cada profissional pode ver sobre você: nome completo, primeiro nome, iniciais ou codinome, e o nível de
        exibição de cada dado. Você pode criar exceções para profissionais específicos e aprovar ou recusar pedidos de acesso a dados ocultos. Um
        pedido aprovado libera só os dados pedidos, só para quem pediu, e pode ser revogado quando você quiser. Os dados ocultos não são enviados à
        tela do profissional.
      </p>
      <p>
        O prontuário é escrito pelos profissionais e não aparece na área do paciente do aplicativo. Ele fica disponível apenas para profissionais da
        clínica que tenham consulta marcada ou realizada com você, segundo a visibilidade definida em cada registro. A administração da clínica não
        tem acesso ao conteúdo do prontuário, às suas informações de saúde nem às mensagens.
      </p>

      <h2>5. Como protegemos os dados</h2>
      <ul>
        <li>Prontuários, dados de saúde, CPF, endereço e mensagens são criptografados no banco de dados (AES-256-GCM).</li>
        <li>
          As senhas são protegidas com hash forte (scrypt) e só você as define: ninguém da clínica, nem a administração, vê ou escolhe a sua senha. Se
          esquecer, você recebe um link de uso único no seu e-mail.
        </li>
        <li>Toda abertura do seu perfil ou do seu prontuário por um profissional é registrada, e você pode consultar esse registro.</li>
        <li>O acesso é sempre restrito ao mínimo necessário para cada função.</li>
      </ul>

      <h2>6. Por quanto tempo guardamos</h2>
      <p>
        O prontuário é guardado por no mínimo 20 anos a partir do último registro, como determina a Lei nº 13.787/2018, e não pode ser apagado nesse
        período. Os demais dados são mantidos enquanto sua conta estiver ativa e, depois, pelo tempo necessário para cumprir obrigações legais e
        fiscais.
      </p>

      <h2>7. Seus direitos</h2>
      <p>Pela LGPD (art. 18), você pode, a qualquer momento:</p>
      <ul>
        <li>confirmar se tratamos seus dados e acessá-los, incluindo uma cópia do seu prontuário;</li>
        <li>corrigir dados incompletos ou desatualizados (a maioria pode ser editada direto em “Meus dados”);</li>
        <li>pedir a anonimização, o bloqueio ou a eliminação de dados desnecessários, respeitados os prazos legais de guarda;</li>
        <li>pedir a portabilidade dos seus dados e informações sobre com quem eles foram compartilhados;</li>
        <li>revogar consentimentos e reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</li>
      </ul>
      <p>
        Para exercer esses direitos, escreva para <a href={`mailto:${contact.email}`}>{contact.email}</a>. Respondemos em até 15 dias.
      </p>

      <h2>8. Cookies</h2>
      <p>Usamos apenas um cookie essencial, que mantém você conectado com segurança. Não usamos cookies de publicidade nem de rastreamento.</p>

      <h2>9. Mudanças nesta política</h2>
      <p>
        Se esta política mudar de forma relevante, avisaremos você antes de a mudança entrar em vigor. Veja também os{" "}
        <Link href="/termos-de-uso">Termos de uso</Link>.
      </p>
    </LegalDocument>
  );
}
