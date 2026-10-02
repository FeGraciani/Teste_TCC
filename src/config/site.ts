/**
 * Identidade e dados institucionais da clínica.
 *
 * ⚠️ Substitua os dados de contato, endereço e responsável técnico pelos
 * dados reais antes de publicar. A propaganda médica no Brasil exige a
 * identificação do diretor técnico com CRM (Resolução CFM nº 2.336/2023).
 */
export const siteConfig = {
  name: "Alento",
  fullName: "Alento Psicologia & Psiquiatria",
  legalName: "Alento Psicologia e Psiquiatria Ltda.",
  cnpj: "00.000.000/0001-00",
  tagline: "Cuidado em saúde mental, com você decidindo o que compartilhar.",
  description:
    "Clínica de psicologia e psiquiatria em São Paulo, com atendimento presencial e online. Agende com poucos cliques e escolha exatamente quais informações cada profissional pode ver.",
  contact: {
    phone: "(11) 3000-0000",
    phoneHref: "tel:+551130000000",
    whatsapp: "(11) 90000-0000",
    whatsappHref: "https://wa.me/5511900000000",
    email: "contato@alento.com.br",
  },
  address: {
    street: "Rua Harmonia, 480",
    district: "Vila Madalena",
    city: "São Paulo",
    state: "SP",
    zip: "05435-000",
  },
  openingHours: [
    { days: "Segunda a sexta", hours: "8h às 21h" },
    { days: "Sábado", hours: "8h às 13h" },
  ],
  technicalDirector: {
    name: "Dra. Helena Duarte",
    role: "Diretora técnica",
    registry: "CRM-SP 000000",
    rqe: "RQE 00000",
  },
  crisisLines: [
    { name: "CVV — Centro de Valorização da Vida", phone: "188", note: "Gratuito, 24 horas, também por chat em cvv.org.br" },
    { name: "SAMU", phone: "192", note: "Emergências médicas" },
  ],
  payment: {
    methods: ["Pix", "Cartão de crédito ou débito"],
    note: "O pagamento é feito no dia da consulta. Emitimos recibo para você pedir reembolso ao seu plano de saúde.",
  },
} as const;

export function copyrightLine(year: number = new Date().getFullYear()): string {
  return `© ${year} ${siteConfig.fullName}. Todos os direitos reservados.`;
}
