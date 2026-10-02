import type { Metadata } from "next";
import { isPortalKey } from "@/modules/identity/domain/portals";
import { ForgotPasswordForm } from "@/modules/identity/presentation/components/account-link-forms";

export const metadata: Metadata = {
  title: "Esqueci minha senha",
  description: "Receba no seu e-mail um link para criar uma nova senha.",
  robots: { index: false },
};

export default async function ForgotPasswordPage({ searchParams }: PageProps<"/esqueci-a-senha">) {
  const params = await searchParams;
  const portal = isPortalKey(params.perfil) ? params.perfil : "paciente";
  return <ForgotPasswordForm backHref={portal === "paciente" ? "/entrar" : `/entrar?perfil=${portal}`} />;
}
