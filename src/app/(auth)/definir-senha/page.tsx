import { KeyRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { inspectAccountLink } from "@/modules/identity/application/account-access-service";
import { getCurrentActor } from "@/modules/identity/application/current-actor";
import { SetPasswordForm } from "@/modules/identity/presentation/components/account-link-forms";
import { ButtonLink } from "@/shared/ui/button";
import { Callout } from "@/shared/ui/callout";

export const metadata: Metadata = {
  title: "Criar senha",
  description: "Crie a sua senha de acesso pelo link recebido por e-mail.",
  robots: { index: false },
};

/** Página do link de uso único enviado por e-mail (convite ou nova senha). Abrir o link não o consome. */
export default async function SetPasswordPage({ searchParams }: PageProps<"/definir-senha">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : null;
  const [link, actor] = await Promise.all([inspectAccountLink(token), getCurrentActor()]);

  if (link.status !== "valid") {
    return (
      <div className="space-y-6">
        <div className="grid size-12 place-items-center rounded-2xl bg-quaresmeira-100 text-quaresmeira-700">
          <KeyRound className="size-6" aria-hidden />
        </div>
        <div className="space-y-2">
          <h1 className="text-[1.9rem] font-bold">Não foi possível usar este link</h1>
          <p className="text-pedra">{link.message}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/esqueci-a-senha">Pedir um novo link</ButtonLink>
          <ButtonLink href="/entrar" variant="secondary">
            Ir para a entrada
          </ButtonLink>
        </div>
        <p className="text-sm text-pedra">
          Convites de profissionais e da administração valem 7 dias; se o seu expirou, peça à clínica para reenviar ou use{" "}
          <Link href="/esqueci-a-senha" className="font-semibold text-quaresmeira-700 hover:underline">
            Esqueci minha senha
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {actor && (
        <Callout tone="warning" title={`Você está conectado como ${actor.name}`}>
          Ao salvar a senha desta outra conta, você sai da sessão atual neste navegador.
        </Callout>
      )}
      <SetPasswordForm token={token!} purpose={link.purpose} firstName={link.firstName} maskedEmail={link.maskedEmail} />
    </div>
  );
}
