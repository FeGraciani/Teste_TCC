import "server-only";
import { formatDateTime } from "@/shared/lib/datetime";
import type { EmailMessage } from "@/shared/infrastructure/email/mailer";
import { renderEmail } from "@/shared/infrastructure/email/template";
import { appUrl } from "@/shared/infrastructure/env";
import { ACCOUNT_LINK_TTL_LABEL } from "../domain/account-links";
import type { Role } from "../domain/roles";

const ROLE_INVITE_TEXT: Record<Role, string> = {
  PATIENT: "a sua conta de paciente",
  PROFESSIONAL: "o seu acesso de profissional",
  ADMIN: "o seu acesso à área administrativa",
};

export function inviteEmail(params: { to: string; firstName: string; role: Role; url: string }): EmailMessage {
  const subject = "Seu acesso ao Alento: crie sua senha";
  return {
    to: params.to,
    subject,
    ...renderEmail({
      preview: "A clínica criou o seu acesso. Falta só criar a sua senha.",
      title: "Crie sua senha de acesso",
      greeting: `Olá, ${params.firstName}.`,
      paragraphs: [
        `A clínica criou ${ROLE_INVITE_TEXT[params.role]}. Para entrar, crie a sua senha pelo botão abaixo.`,
        `O link é pessoal, funciona uma única vez e vale por ${ACCOUNT_LINK_TTL_LABEL.INVITE}. Ninguém da clínica tem acesso à senha que você escolher.`,
      ],
      action: { label: "Criar minha senha", url: params.url },
      note: "Se você não esperava este convite, ignore este e-mail.",
    }),
  };
}

export function passwordResetEmail(params: { to: string; firstName: string; url: string }): EmailMessage {
  const subject = "Redefinição de senha do Alento";
  return {
    to: params.to,
    subject,
    ...renderEmail({
      preview: "Use o link para escolher uma nova senha.",
      title: "Escolha uma nova senha",
      greeting: `Olá, ${params.firstName}.`,
      paragraphs: [
        "Recebemos um pedido para redefinir a senha da sua conta. Para escolher uma nova senha, use o botão abaixo.",
        `O link funciona uma única vez e vale por ${ACCOUNT_LINK_TTL_LABEL.PASSWORD_RESET}. Sua senha atual continua valendo até você trocá-la.`,
      ],
      action: { label: "Escolher nova senha", url: params.url },
      note: "Se não foi você que pediu, ignore este e-mail: nada muda na sua conta.",
    }),
  };
}

export function passwordChangedEmail(params: { to: string; firstName: string; when: Date }): EmailMessage {
  return {
    to: params.to,
    subject: "Sua senha do Alento foi alterada",
    ...renderEmail({
      preview: "Aviso de segurança: a senha da sua conta foi alterada.",
      title: "Sua senha foi alterada",
      greeting: `Olá, ${params.firstName}.`,
      paragraphs: [
        `A senha da sua conta foi alterada em ${formatDateTime(params.when)} (horário de Brasília). Por segurança, encerramos as sessões abertas em outros aparelhos.`,
        "Se foi você, está tudo certo e não é preciso fazer nada.",
      ],
      action: { label: "Não fui eu: redefinir a senha", url: `${appUrl()}/esqueci-a-senha` },
      note: "Se não foi você, redefina a senha agora e avise a clínica.",
    }),
  };
}
