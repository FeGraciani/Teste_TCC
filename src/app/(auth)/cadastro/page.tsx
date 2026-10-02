import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentActor } from "@/modules/identity/application/current-actor";
import { ROLE_HOME } from "@/modules/identity/domain/roles";
import { SignUpForm } from "@/modules/identity/presentation/components/sign-up-form";

export const metadata: Metadata = {
  title: "Criar conta",
  description: "Crie sua conta de paciente na Alento e agende sua primeira consulta.",
};

export default async function SignUpPage() {
  const actor = await getCurrentActor();
  if (actor) redirect(ROLE_HOME[actor.role]);
  return <SignUpForm />;
}
