import type { MetadataRoute } from "next";
import { connection } from "next/server";

/**
 * Páginas públicas para buscadores. As áreas logadas ficam de fora (ver robots.txt).
 * Gerado a cada pedido (e não no build) para usar o APP_URL do ambiente em
 * que o app está rodando — a imagem Docker é compilada sem saber o domínio final.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const pages = [
    { path: "/", priority: 1 },
    { path: "/como-funciona", priority: 0.9 },
    { path: "/valores", priority: 0.9 },
    { path: "/equipe", priority: 0.8 },
    { path: "/politica-de-privacidade", priority: 0.3 },
    { path: "/termos-de-uso", priority: 0.3 },
  ];
  return pages.map((page) => ({ url: `${base}${page.path}`, changeFrequency: "monthly", priority: page.priority }));
}
