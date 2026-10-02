import { CalendarPlus, KeyRound, MessageCircle, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/modules/identity/application/current-actor";
import { getOwnProfile } from "@/modules/identity/application/patient-profile-service";
import { countUnreadMessages } from "@/modules/messaging/application/chat-service";
import { getPrivacySummary } from "@/modules/privacy/application/privacy-service";
import { presetLabel } from "@/modules/privacy/domain/privacy-fields";
import { firstName } from "@/modules/privacy/domain/projection";
import { listPatientAppointments } from "@/modules/scheduling/application/agenda-service";
import { PatientAppointmentCard } from "@/modules/scheduling/presentation/components/patient-appointment-card";
import { ButtonLink } from "@/shared/ui/button";
import { Callout } from "@/shared/ui/callout";
import { CrisisNote } from "@/shared/ui/crisis-note";
import { EmptyState, Panel } from "@/shared/ui/layout";

export const metadata: Metadata = { title: "Início" };

export default async function PatientHomePage({ searchParams }: PageProps<"/paciente">) {
  const actor = await requireRole("PATIENT");
  const params = await searchParams;
  const [profile, { upcoming }, privacy, unread] = await Promise.all([
    getOwnProfile(actor),
    listPatientAppointments(actor),
    getPrivacySummary(actor),
    countUnreadMessages(actor),
  ]);
  const greetingName = profile.preferredName?.trim() || firstName(profile.fullName);
  const next = upcoming[0];

  return (
    <div className="space-y-8">
      {params["boas-vindas"] && (
        <Callout tone="success" title="Sua conta está pronta!" role="status">
          Para os profissionais, você aparece como <strong>{privacy.displayName}</strong> (modo {presetLabel(privacy.preset).toLowerCase()}). Você
          pode mudar isso quando quiser em <Link href="/paciente/privacidade">Privacidade</Link>. Que tal escolher seu primeiro horário?
        </Callout>
      )}

      <header className="space-y-1.5">
        <h1 className="text-[1.9rem] font-bold sm:text-[2.2rem]">Olá, {greetingName}</h1>
        <p className="text-[1.02rem] text-pedra">Que bom ter você aqui. Este é o seu espaço: consultas, conversas e privacidade.</p>
      </header>

      {privacy.pendingRequests > 0 && (
        <Callout
          tone="warning"
          title={privacy.pendingRequests === 1 ? "Um profissional pediu acesso a um dado oculto" : "Profissionais pediram acesso a dados ocultos"}
        >
          Você decide se libera ou não. <Link href="/paciente/privacidade">Ver pedido{privacy.pendingRequests > 1 ? "s" : ""}</Link>
        </Callout>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Panel
          title="Próxima consulta"
          actions={
            upcoming.length > 1 ? (
              <Link href="/paciente/consultas" className="text-sm font-semibold text-quaresmeira-700 hover:underline">
                Ver todas ({upcoming.length})
              </Link>
            ) : null
          }
        >
          {next ? (
            <PatientAppointmentCard appointment={next} />
          ) : (
            <EmptyState
              icon={<CalendarPlus className="size-5" aria-hidden />}
              title="Nenhuma consulta marcada"
              action={<ButtonLink href="/paciente/agendar">Agendar consulta</ButtonLink>}
            >
              Escolha o tipo de atendimento, o profissional e um horário livre. Leva um minuto.
            </EmptyState>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="Como você aparece">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-quaresmeira-50 text-quaresmeira-700">
                  <ShieldCheck className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-xl font-bold">{privacy.displayName}</p>
                  <p className="text-sm text-pedra">Modo {presetLabel(privacy.preset).toLowerCase()}, na configuração padrão</p>
                </div>
              </div>
              {privacy.overrides > 0 && (
                <p className="flex items-center gap-2 text-sm text-pedra">
                  <KeyRound className="size-4" aria-hidden />
                  {privacy.overrides === 1
                    ? "1 profissional tem uma configuração exclusiva"
                    : `${privacy.overrides} profissionais têm configuração exclusiva`}
                </p>
              )}
              {privacy.professionalsWithGrants > 0 && (
                <p className="flex items-center gap-2 text-sm text-pedra">
                  <KeyRound className="size-4" aria-hidden />
                  {privacy.professionalsWithGrants === 1
                    ? "1 profissional tem dados liberados por pedido"
                    : `${privacy.professionalsWithGrants} profissionais têm dados liberados por pedido`}
                </p>
              )}
              <ButtonLink href="/paciente/privacidade" variant="secondary" size="sm">
                Ajustar privacidade
              </ButtonLink>
            </div>
          </Panel>

          <Panel title="Mensagens">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-[0.98rem]">
                <MessageCircle className="size-5 text-quaresmeira-600" aria-hidden />
                {unread > 0 ? (
                  <span>
                    <strong>{unread}</strong> {unread === 1 ? "mensagem não lida" : "mensagens não lidas"}
                  </span>
                ) : (
                  <span className="text-pedra">Nenhuma mensagem nova</span>
                )}
              </p>
              <ButtonLink href="/paciente/mensagens" variant="quiet" size="sm">
                Abrir
              </ButtonLink>
            </div>
          </Panel>
        </div>
      </div>

      <CrisisNote />
    </div>
  );
}
