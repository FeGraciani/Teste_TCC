import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, isDemoMode } from "@/config/demo";
import { getCurrentActor } from "@/modules/identity/application/current-actor";
import { isPortalKey } from "@/modules/identity/domain/portals";
import { ROLE_HOME } from "@/modules/identity/domain/roles";
import { SignInForm } from "@/modules/identity/presentation/components/sign-in-form";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesso de pacientes, profissionais e administração da clínica Alento.",
};

export default async function SignInPage({ searchParams }: PageProps<"/entrar">) {
  const params = await searchParams;
  const actor = await getCurrentActor();
  if (actor) redirect(ROLE_HOME[actor.role]);

  const portal = isPortalKey(params.perfil) ? params.perfil : "paciente";
  const next = typeof params.next === "string" ? params.next : "";
  const demoAccounts = isDemoMode() ? DEMO_ACCOUNTS[portal].map((account) => ({ ...account, password: DEMO_PASSWORD })) : [];

  const notice = params.senha === "definida" ? "Senha salva. Agora é só entrar com o seu e-mail e a nova senha." : null;

  return <SignInForm portal={portal} next={next} demoAccounts={demoAccounts} notice={notice} />;
}
