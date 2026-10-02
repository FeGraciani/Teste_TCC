import { copyrightLine, siteConfig } from "@/config/site";

/**
 * Modelo único dos e-mails da clínica: texto simples + HTML com estilos
 * embutidos (compatível com os principais leitores de e-mail).
 *
 * Por discrição, os e-mails NUNCA trazem conteúdo clínico, especialidade ou
 * motivo de consulta: o assunto e o corpo dizem só o necessário, e o detalhe
 * fica dentro do app, atrás do login.
 */
export type EmailContent = {
  /** Texto curto exibido como prévia na caixa de entrada. */
  preview: string;
  title: string;
  greeting?: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  /** Observação final em letra menor (ex.: "se não foi você, ignore"). */
  note?: string;
};

const COLORS = {
  background: "#f4f3f8",
  card: "#ffffff",
  ink: "#1f1c30",
  muted: "#625e74",
  line: "#e1deeb",
  brand: "#463b8b",
};

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function footerLines(): string[] {
  const { address } = siteConfig;
  return [
    `${siteConfig.fullName} · ${address.street}, ${address.district}, ${address.city}/${address.state}`,
    "Em crise? Ligue 188 (CVV, 24h) ou 192 (SAMU).",
    "Este é um e-mail automático. Para falar com a clínica, use o app ou nossos canais oficiais.",
    copyrightLine(),
  ];
}

export function renderEmail(content: EmailContent): { text: string; html: string } {
  const text = [
    content.title,
    "",
    ...(content.greeting ? [content.greeting, ""] : []),
    ...content.paragraphs.flatMap((paragraph) => [paragraph, ""]),
    ...(content.action ? [`${content.action.label}: ${content.action.url}`, ""] : []),
    ...(content.note ? [content.note, ""] : []),
    "—",
    ...footerLines(),
  ].join("\n");

  const paragraph = (value: string) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${COLORS.ink};">${escapeHtml(value)}</p>`;

  const button = content.action
    ? `<p style="margin:24px 0;"><a href="${escapeHtml(content.action.url)}" style="display:inline-block;background:${COLORS.brand};color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:12px 22px;border-radius:12px;">${escapeHtml(content.action.label)}</a></p>
       <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:${COLORS.muted};">Se o botão não funcionar, copie e cole este endereço no navegador:<br><span style="word-break:break-all;">${escapeHtml(content.action.url)}</span></p>`
    : "";

  const html = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(content.title)}</title></head>
<body style="margin:0;padding:0;background:${COLORS.background};font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(content.preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.background};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:0 4px 16px;font-size:22px;font-weight:700;color:${COLORS.brand};">${escapeHtml(siteConfig.name.toLowerCase())}</td></tr>
<tr><td style="background:${COLORS.card};border:1px solid ${COLORS.line};border-radius:20px;padding:28px 24px;">
<h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:${COLORS.ink};">${escapeHtml(content.title)}</h1>
${content.greeting ? paragraph(content.greeting) : ""}
${content.paragraphs.map(paragraph).join("\n")}
${button}
${content.note ? `<p style="margin:16px 0 0;font-size:14px;line-height:1.5;color:${COLORS.muted};">${escapeHtml(content.note)}</p>` : ""}
</td></tr>
<tr><td style="padding:18px 4px 0;font-size:12px;line-height:1.6;color:${COLORS.muted};">${footerLines().map(escapeHtml).join("<br>")}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { text, html };
}
