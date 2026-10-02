import type { Metadata } from "next";
import Link from "next/link";
import { MINIMUM_PATIENT_AGE, PATIENT_CANCELLATION_MIN_HOURS } from "@/config/clinic";
import { siteConfig } from "@/config/site";
import { LegalDocument } from "../_components/legal-document";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: "Regras de uso do site e do aplicativo da Alento Psicologia & Psiquiatria.",
};

/*
 * Texto-base. Antes de publicar, revise com a assessoria jurídica da clínica.
 */
export default function TermsPage() {
  const { legalName, cnpj, contact, address } = siteConfig;
  return (
    <LegalDocument title="Termos de uso" updatedAt="1º de outubro de 2026">
      <p>
        Estes termos regulam o uso do site e do aplicativo da {legalName}, CNPJ {cnpj} (“Alento”). Ao criar uma conta, você concorda com eles e com a
        nossa <Link href="/politica-de-privacidade">Política de privacidade</Link>.
      </p>

      <h2>1. O serviço</h2>
      <p>
        A Alento oferece agendamento de consultas de psicologia e psiquiatria, presenciais e online, um canal de mensagens entre paciente e
        profissional e ferramentas para o paciente controlar quais dados cada profissional pode ver.
      </p>

      <h2>2. Quem pode usar</h2>
      <p>
        O cadastro pelo aplicativo é para pessoas com {MINIMUM_PATIENT_AGE} anos ou mais. O atendimento de crianças e adolescentes é agendado
        diretamente com a clínica, com a participação de um responsável legal.
      </p>

      <h2>3. Sua conta</h2>
      <ul>
        <li>Mantenha seus dados de acesso em sigilo. A conta é pessoal e intransferível.</li>
        <li>Informe dados verdadeiros. Você escolhe o que os profissionais veem, mas o cadastro precisa ser real para fins legais e de cobrança.</li>
        <li>Se suspeitar de uso indevido, troque sua senha e avise a clínica.</li>
      </ul>

      <h2>4. Agendamento e cancelamento</h2>
      <ul>
        <li>Só é possível agendar nos horários exibidos como disponíveis. O horário fica reservado no momento da confirmação.</li>
        <li>Você pode cancelar pelo aplicativo, sem custo, até {PATIENT_CANCELLATION_MIN_HOURS} horas antes do início da consulta.</li>
        <li>O profissional ou a clínica podem cancelar em caso de imprevisto, sempre informando o motivo pelo chat.</li>
        <li>Faltas sem aviso podem ser cobradas, conforme combinado com o profissional.</li>
      </ul>

      <h2>5. Pagamento</h2>
      <p>
        Os valores vigentes estão na página <Link href="/valores">Valores</Link> e ficam registrados em cada consulta no momento do agendamento. O
        pagamento é feito no dia da consulta. Emitimos recibo para pedido de reembolso ao plano de saúde.
      </p>

      <h2>6. Atendimento online</h2>
      <p>
        As consultas online seguem as normas do Conselho Federal de Medicina e do Conselho Federal de Psicologia. Escolha um lugar reservado e uma
        conexão estável. A sala virtual é liberada pouco antes do horário marcado.
      </p>

      <h2>7. Este aplicativo não é para emergências</h2>
      <p>
        O chat é para combinar detalhes e avisar imprevistos, não para atendimento de urgência. Em crise, ligue 188 (CVV, 24 horas, gratuito) ou 192
        (SAMU), ou procure o pronto-socorro mais próximo.
      </p>

      <h2>8. Conduta</h2>
      <p>
        Trate profissionais e equipe com respeito. Mensagens ofensivas, discriminatórias ou ameaçadoras podem levar à suspensão da conta, sem prejuízo
        do acesso ao seu prontuário.
      </p>

      <h2>9. Propriedade intelectual</h2>
      <p>
        A marca Alento, o conteúdo, o design e o software deste site e do aplicativo pertencem à {legalName}. Todos os direitos reservados. É proibido
        copiar, modificar ou distribuir qualquer parte sem autorização por escrito.
      </p>

      <h2>10. Contato e foro</h2>
      <p>
        Dúvidas sobre estes termos: <a href={`mailto:${contact.email}`}>{contact.email}</a>. Fica eleito o foro da comarca de {address.city}/
        {address.state}, ressalvado o direito do consumidor de propor ação no foro do seu domicílio.
      </p>
    </LegalDocument>
  );
}
