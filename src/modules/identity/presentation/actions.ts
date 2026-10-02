"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { recordAudit } from "@/modules/audit/application/audit-service";
import { afterResponse } from "@/shared/infrastructure/after-response";
import type { ActionState } from "@/shared/lib/action-state";
import { formDataToObject } from "@/shared/lib/validation";
import { runAction } from "@/shared/presentation/run-action";
import { completeAccountLink, requestPasswordReset } from "../application/account-access-service";
import { authenticate, changePassword, emailSchema, registerPatient } from "../application/auth-service";
import { getCurrentActor, requireActor, requireRole } from "../application/current-actor";
import { regenerateOwnPseudonym, updateOwnProfile } from "../application/patient-profile-service";
import { updateOwnProfessionalProfile } from "../application/professional-profile-service";
import { createSession, destroyCurrentSession, requestIp } from "../application/session";
import { ACCOUNT_LINK_TTL_LABEL } from "../domain/account-links";
import { PORTALS, isPortalKey, portalOfRole } from "../domain/portals";
import { safeRedirectPath, type Role } from "../domain/roles";

const WRONG_PORTAL_MESSAGES: Record<Role, string> = {
  PATIENT: "Esta é uma conta de paciente. Escolha a opção “Paciente” acima para entrar.",
  PROFESSIONAL: "Esta é uma conta de profissional. Escolha a opção “Profissional” acima para entrar.",
  ADMIN: "Esta é uma conta da administração. Escolha a opção “Administração” acima para entrar.",
};

/** Entrada nos três portais: paciente, profissional e administração. */
export async function signInAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const rawPortal = String(formData.get("portal") ?? "");
  const portal = isPortalKey(rawPortal) ? rawPortal : "paciente";
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const values = { email, portal };

  if (!email || !password) {
    return { status: "error", message: "Informe seu e-mail e sua senha.", values, at: Date.now() };
  }

  const result = await authenticate(email, password, await requestIp(), PORTALS[portal].role);
  if (!result.ok) {
    const message =
      result.reason === "WRONG_PORTAL"
        ? WRONG_PORTAL_MESSAGES[result.role]
        : result.reason === "RATE_LIMITED"
          ? "Muitas tentativas seguidas. Por segurança, aguarde 15 minutos e tente de novo."
          : result.reason === "INACTIVE"
            ? "Este acesso está desativado. Fale com a clínica para reativá-lo."
            : "E-mail ou senha incorretos.";
    return { status: "error", message, values, at: Date.now() };
  }

  await createSession(result.userId);
  redirect(safeRedirectPath(String(formData.get("next") ?? ""), result.role));
}

/** Cadastro de paciente (profissionais e administradores são criados pela clínica). */
export async function signUpAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { userId } = await registerPatient(formDataToObject(formData), await requestIp());
    await createSession(userId);
    redirect("/paciente?boas-vindas=1");
  }, formData);
}

/**
 * "Esqueci minha senha". A resposta é sempre a mesma e o envio acontece
 * depois da resposta: nem a mensagem nem o tempo revelam se o e-mail existe.
 */
export async function requestPasswordResetAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? ""));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Informe o e-mail da sua conta.",
      fieldErrors: { email: ["Informe um e-mail válido."] },
      values: { email: String(formData.get("email") ?? "") },
      at: Date.now(),
    };
  }
  const ip = await requestIp();
  await afterResponse(() => requestPasswordReset(parsed.data, ip));
  return {
    status: "success",
    message: `Se houver uma conta com ${parsed.data}, enviamos um link para criar uma nova senha. Ele vale ${ACCOUNT_LINK_TTL_LABEL.PASSWORD_RESET}. Confira também a caixa de spam.`,
    at: Date.now(),
  };
}

/** Cria a senha pelo link do e-mail (convite ou redefinição) e leva para a entrada do portal certo. */
export async function completeAccountLinkAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const token = String(formData.get("token") ?? "");
    const { role } = await completeAccountLink(token, formDataToObject(formData), await requestIp());
    // Quem estava conectado com OUTRA conta neste navegador sai dela.
    await destroyCurrentSession();
    const portal = portalOfRole(role);
    redirect(`/entrar?${portal === "paciente" ? "" : `perfil=${portal}&`}senha=definida`);
  }, formData);
}

export async function signOutAction(): Promise<void> {
  const actor = await getCurrentActor();
  if (actor) await recordAudit({ actor, action: "AUTH_LOGOUT", entityType: "user", entityId: actor.userId });
  await destroyCurrentSession();
  redirect("/entrar");
}

export async function changePasswordAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireActor();
  return runAction(async () => {
    await changePassword(actor, formDataToObject(formData));
    return "Senha alterada. Se havia outra sessão aberta em outro aparelho, ela foi encerrada.";
  }, formData);
}

export async function updatePatientProfileAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("PATIENT");
  return runAction(async () => {
    await updateOwnProfile(actor, formDataToObject(formData));
    refresh();
    return "Dados atualizados. O que cada profissional vê continua seguindo suas preferências de privacidade.";
  }, formData);
}

export async function regeneratePseudonymAction(): Promise<ActionState> {
  const actor = await requireRole("PATIENT");
  return runAction(async () => {
    const pseudonym = await regenerateOwnPseudonym(actor);
    refresh();
    return `Pronto! Seu novo codinome é ${pseudonym}.`;
  });
}

export async function updateProfessionalProfileAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("PROFESSIONAL");
  return runAction(async () => {
    await updateOwnProfessionalProfile(actor, formDataToObject(formData));
    refresh();
    return "Apresentação atualizada. Ela aparece no site e na escolha de profissional.";
  }, formData);
}
