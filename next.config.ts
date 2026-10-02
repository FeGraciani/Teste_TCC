import type { NextConfig } from "next";

/**
 * Cabeçalhos de segurança aplicados a todas as respostas.
 * Dados de saúde mental são dados sensíveis (LGPD, art. 5º, II): o app nunca
 * deve ser incorporado em iframes de terceiros nem vazar URLs internas.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

if (process.env.NODE_ENV === "production") {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  });
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["pg", "nodemailer"],
  // A imagem Docker usa o servidor enxuto ("standalone"); em hospedagens como a Vercel, não é necessário.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Áreas autenticadas nunca devem ser armazenadas em cache compartilhado.
        source: "/(paciente|profissional|admin)/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
      {
        // O link de criar senha carrega um segredo na URL: nada de cache nem de Referer.
        source: "/definir-senha",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
