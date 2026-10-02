import { Eye, FileLock2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CLINIC_TIME_ZONE } from "@/config/clinic";
import { siteConfig } from "@/config/site";
import { requireRole } from "@/modules/identity/application/current-actor";
import { getPrivacyOverview } from "@/modules/privacy/application/privacy-service";
import { AccessRequestCard } from "@/modules/privacy/presentation/components/access-request-card";
import { ActiveGrants } from "@/modules/privacy/presentation/components/active-grants";
import { PrivacyEditor } from "@/modules/privacy/presentation/components/privacy-editor";
import { PseudonymCard } from "@/modules/privacy/presentation/components/pseudonym-card";
import { todayKey } from "@/modules/scheduling/domain/availability";
import { cn } from "@/shared/lib/cn";
import { formatDate, formatTime } from "@/shared/lib/datetime";
import { PageHeader, Panel } from "@/shared/ui/layout";

export const metadata: Metadata = { title: "Privacidade" };

export default async function PatientPrivacyPage({ searchParams }: PageProps<"/paciente/privacidade">) {
  const actor = await requireRole("PATIENT");
  const params = await searchParams;
  const overview = await getPrivacyOverview(actor);

  const allProfessionals = [...overview.careTeam, ...overview.otherProfessionals];
  const selected = typeof params.profissional === "string" ? allProfessionals.find((item) => item.professionalId === params.profissional) : undefined;
  const othersWithOverride = overview.otherProfessionals.filter((item) => item.hasOverride || item.grantedFields.length > 0);
  const othersWithoutOverride = overview.otherProfessionals.filter((item) => !item.hasOverride && item.grantedFields.length === 0);

  const scopeTabs = [
    { key: "padrao", href: "/paciente/privacidade", label: "Padrão", detail: "todos os profissionais", active: !selected, override: false },
    ...[...overview.careTeam, ...othersWithOverride].map((member) => ({
      key: member.professionalId,
      href: `/paciente/privacidade?profissional=${member.professionalId}`,
      label: member.displayName,
      detail: member.hasOverride ? "exceção ativa" : member.grantedFields.length > 0 ? "padrão + liberações" : "segue o padrão",
      active: selected?.professionalId === member.professionalId,
      override: member.hasOverride || member.grantedFields.length > 0,
    })),
  ];

  return (
    <>
      <PageHeader
        title="Sua privacidade"
        description="Escolha o que cada profissional pode ver sobre você. Seus dados completos ficam guardados com segurança; cada profissional recebe só o que você liberar."
      />

      {overview.pendingRequests.length > 0 && (
        <section aria-labelledby="pedidos" className="mb-8 space-y-3">
          <h2 id="pedidos" className="text-xl font-bold">
            Pedidos aguardando sua resposta
          </h2>
          {overview.pendingRequests.map((request) => (
            <AccessRequestCard key={request.id} request={{ ...request, createdAt: request.createdAt.toISOString() }} />
          ))}
        </section>
      )}

      {overview.activeGrants.length > 0 && (
        <ActiveGrants
          grants={overview.activeGrants.map((grant) => ({
            ...grant,
            fields: grant.fields.map((field) => ({ ...field, grantedAt: field.grantedAt.toISOString() })),
          }))}
        />
      )}

      <nav aria-label="Para quem valem as preferências" className="mb-6 space-y-3">
        <p className="text-sm font-semibold text-pedra">Para quem valem as preferências abaixo</p>
        <ul className="flex flex-wrap gap-2">
          {scopeTabs.map((tab) => (
            <li key={tab.key}>
              <Link
                href={tab.href}
                scroll={false}
                aria-current={tab.active ? "page" : undefined}
                className={cn(
                  "flex flex-col rounded-2xl border px-4 py-2.5 transition-colors",
                  tab.active ? "border-quaresmeira-700 bg-quaresmeira-700 text-white" : "border-linha bg-papel hover:border-quaresmeira-300",
                )}
              >
                <span className="font-semibold">{tab.label}</span>
                <span
                  className={cn("text-xs", tab.active ? "text-quaresmeira-100" : tab.override ? "font-semibold text-quaresmeira-700" : "text-pedra")}
                >
                  {tab.detail}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {othersWithoutOverride.length > 0 && (
          <form action="/paciente/privacidade" className="flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="outro-profissional" className="text-pedra">
              Criar exceção para outro profissional:
            </label>
            <select
              id="outro-profissional"
              name="profissional"
              defaultValue=""
              className="h-9 rounded-lg border border-linha-forte bg-papel px-2 text-sm"
              required
            >
              <option value="" disabled>
                Escolha
              </option>
              {othersWithoutOverride.map((member) => (
                <option key={member.professionalId} value={member.professionalId}>
                  {member.displayName} ({member.title})
                </option>
              ))}
            </select>
            <button type="submit" className="h-9 rounded-lg px-3 font-semibold text-quaresmeira-700 hover:bg-quaresmeira-50">
              Abrir
            </button>
          </form>
        )}
      </nav>

      <PrivacyEditor
        key={`${selected?.professionalId ?? "padrao"}-${selected?.hasOverride ? "excecao" : "padrao"}`}
        scope={{
          professionalId: selected?.professionalId ?? null,
          professionalName: selected?.displayName ?? null,
          hasOverride: selected?.hasOverride ?? false,
          grantedFields: selected?.grantedFields ?? [],
          professionalsWithGrants: overview.activeGrants.length,
        }}
        initialFields={selected?.overrideFields ?? overview.defaultFields}
        personalData={overview.personalData}
        today={todayKey(CLINIC_TIME_ZONE)}
      />

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <PseudonymCard pseudonym={overview.personalData.pseudonym} />

        <section aria-labelledby="prontuario" className="space-y-3 rounded-[1.25rem] border border-linha bg-papel p-5 sm:p-6">
          <h2 id="prontuario" className="flex items-center gap-2 text-lg font-bold">
            <FileLock2 className="size-5 text-quaresmeira-600" aria-hidden />E o prontuário?
          </h2>
          <p className="text-[0.95rem]">
            O prontuário é escrito pelos profissionais que atendem você e segue para quem continuar o seu cuidado, sempre com a identidade que você
            escolheu acima. Ele não aparece nesta área do app.
          </p>
          <p className="text-[0.95rem] text-pedra">
            Você tem direito a uma cópia sempre que quiser (LGPD, art. 18). Peça pelo e-mail{" "}
            <a
              href={`mailto:${siteConfig.contact.email}?subject=Pedido%20de%20c%C3%B3pia%20do%20prontu%C3%A1rio`}
              className="font-semibold text-quaresmeira-700 underline"
            >
              {siteConfig.contact.email}
            </a>
            .
          </p>
        </section>
      </div>

      <Panel
        className="mt-6"
        title="Quem acessou seus dados"
        description="Cada vez que um profissional abre seu perfil ou seu prontuário, fica registrado aqui."
      >
        {overview.accessLog.length > 0 ? (
          <ul className="divide-y divide-linha">
            {overview.accessLog.map((entry) => (
              <li key={`${entry.professionalName}-${entry.day}`} className="flex flex-wrap items-start justify-between gap-2 py-3">
                <div className="flex gap-3">
                  <Eye className="mt-1 size-4 shrink-0 text-pedra" aria-hidden />
                  <div>
                    <p className="font-semibold">
                      {entry.professionalName} <span className="font-normal text-pedra">({entry.professionalTitle})</span>
                    </p>
                    <p className="text-sm text-pedra">
                      {[entry.sawProfile && "viu seu perfil", entry.sawRecords && "consultou o prontuário"].filter(Boolean).join(" e ")}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-pedra">
                  {formatDate(entry.lastAt)}, último acesso às {formatTime(entry.lastAt)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-pedra">Nenhum profissional acessou seus dados ainda.</p>
        )}
      </Panel>
    </>
  );
}
