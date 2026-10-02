import "server-only";
import { createTransport } from "nodemailer";
import { siteConfig } from "@/config/site";

/**
 * Envio de e-mails transacionais (convite, nova senha, avisos de consulta).
 *
 * - Com SMTP_URL configurado, envia pelo provedor (qualquer serviço com SMTP:
 *   Amazon SES, SendGrid, Resend, Mailgun, Google Workspace…).
 * - Em desenvolvimento, sem SMTP_URL, o e-mail aparece no terminal do servidor.
 * - Nos testes, fica numa caixa de saída em memória.
 * - Em produção, sem SMTP_URL, NADA é enviado e o conteúdo NÃO vai para os logs
 *   (links de acesso são segredos): só um aviso de configuração.
 */

export type EmailMessage = { to: string; subject: string; text: string; html: string };
export type EmailTransportKind = "smtp" | "dev-console" | "memory" | "disabled";
export type EmailDelivery = { delivered: boolean; transport: EmailTransportKind };
export type OutboxEntry = EmailMessage & { sentAt: Date };

const OUTBOX_LIMIT = 50;

const globalForMail = globalThis as unknown as {
  alentoOutbox?: OutboxEntry[];
  alentoSmtp?: ReturnType<typeof createTransport>;
};
const outbox: OutboxEntry[] = (globalForMail.alentoOutbox ??= []);

export function emailTransportKind(): EmailTransportKind {
  if (process.env.SMTP_URL) return "smtp";
  if (process.env.NODE_ENV === "test") return "memory";
  if (process.env.NODE_ENV === "production") return "disabled";
  return "dev-console";
}

export function mailFrom(): string {
  return process.env.MAIL_FROM || `${siteConfig.fullName} <nao-responda@alento.example>`;
}

function smtp() {
  globalForMail.alentoSmtp ??= createTransport(process.env.SMTP_URL!, { from: mailFrom() });
  return globalForMail.alentoSmtp;
}

function keep(message: EmailMessage) {
  outbox.push({ ...message, sentAt: new Date() });
  if (outbox.length > OUTBOX_LIMIT) outbox.splice(0, outbox.length - OUTBOX_LIMIT);
}

/** Envia (ou registra, fora de produção). Lança erro se o provedor SMTP recusar. */
export async function sendEmail(message: EmailMessage): Promise<EmailDelivery> {
  const transport = emailTransportKind();
  switch (transport) {
    case "smtp":
      await smtp().sendMail({ to: message.to, subject: message.subject, text: message.text, html: message.html });
      return { delivered: true, transport };
    case "memory":
      keep(message);
      return { delivered: false, transport };
    case "dev-console":
      keep(message);
      console.info(
        [
          "",
          "┌─ E-mail (desenvolvimento: SMTP_URL não configurado, nada foi enviado) ─────",
          `│ Para: ${message.to}`,
          `│ Assunto: ${message.subject}`,
          "│",
          ...message.text.split("\n").map((line) => `│ ${line}`),
          "└────────────────────────────────────────────────────────────────────────────",
          "",
        ].join("\n"),
      );
      return { delivered: false, transport };
    case "disabled":
      console.warn(`[e-mail] SMTP_URL não configurado: o e-mail "${message.subject}" NÃO foi enviado. Configure SMTP_URL e MAIL_FROM.`);
      return { delivered: false, transport };
  }
}

/**
 * Como sendEmail, mas nunca lança: registra a falha e segue. Use quando o
 * e-mail é complementar (o aviso principal já está no chat do app).
 */
export async function trySendEmail(message: EmailMessage): Promise<EmailDelivery> {
  try {
    return await sendEmail(message);
  } catch (error) {
    console.error(`[e-mail] falha ao enviar "${message.subject}"`, error);
    return { delivered: false, transport: emailTransportKind() };
  }
}

/** Caixa de saída em memória: e-mails registrados em desenvolvimento e nos testes. */
export function readOutbox(): readonly OutboxEntry[] {
  return outbox;
}

export function clearOutbox(): void {
  outbox.length = 0;
}
