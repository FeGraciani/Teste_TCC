import { CalendarX2, Clock, Monitor, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { listServices } from "@/modules/catalog/application/catalog-service";
import { listPublicProfessionals } from "@/modules/identity/application/directory-service";
import { requireRole } from "@/modules/identity/application/current-actor";
import { resolveDisplayNames, describePolicyForProfessional } from "@/modules/privacy/application/privacy-service";
import { presetLabel } from "@/modules/privacy/domain/privacy-fields";
import { getAvailabilityForBooking, getProfessionalForBooking } from "@/modules/scheduling/application/availability-service";
import { BookingConfirmForm } from "@/modules/scheduling/presentation/components/booking-confirm-form";
import { BookingStepper, ProfessionalChooser, ServiceChooser, SlotPicker, bookingHref } from "@/modules/scheduling/presentation/components/booking";
import { capitalize, formatTime, formatWeekdayLong } from "@/shared/lib/datetime";
import { formatBRL } from "@/shared/lib/money";
import { Avatar, specialtyTone } from "@/shared/ui/avatar";
import { ButtonLink } from "@/shared/ui/button";
import { Callout } from "@/shared/ui/callout";
import { EmptyState, PageHeader, Panel } from "@/shared/ui/layout";

export const metadata: Metadata = { title: "Agendar consulta" };

function monogramOf(name: string): string {
  const parts = name.replace(/^(Dra?\.)\s+/i, "").split(/\s+/);
  return ((parts[0]?.charAt(0) ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : "")).toUpperCase();
}

export default async function BookingPage({ searchParams }: PageProps<"/paciente/agendar">) {
  const actor = await requireRole("PATIENT");
  const params = await searchParams;
  const pick = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
  const serviceParam = pick("servico");
  const professionalParam = pick("profissional");
  const dayParam = pick("dia");
  const slotParam = pick("horario");

  const services = await listServices();
  const loadedProfessional = professionalParam ? await getProfessionalForBooking(professionalParam) : null;
  const professional = loadedProfessional?.userActive ? loadedProfessional : null;
  const service = serviceParam ? services.find((item) => item.id === serviceParam) : undefined;
  const professionalMatches = Boolean(professional && service && professional.specialty === service.specialty);

  const header = (
    <PageHeader title="Agendar consulta" description="Só aparecem horários realmente livres. O horário fica reservado assim que você confirma." />
  );

  // Etapa 1 — tipo de atendimento
  if (!service) {
    const available = professional ? services.filter((item) => item.specialty === professional.specialty) : services;
    return (
      <>
        {header}
        <BookingStepper current={1} links={[null, null, null, null]} />
        {professional && (
          <Callout className="mb-6" title={`Agendando com ${professional.displayName}`}>
            Escolha o tipo de atendimento. <Link href="/paciente/agendar">Prefere ver todos os profissionais?</Link>
          </Callout>
        )}
        {available.length > 0 ? (
          <ServiceChooser services={available} professionalId={professional?.id} />
        ) : (
          <EmptyState title="Nenhum atendimento disponível no momento">Fale com a clínica pelo telefone para agendar.</EmptyState>
        )}
      </>
    );
  }

  const serviceSummary = (
    <p className="text-[0.95rem] text-pedra">
      <span className="font-semibold text-tinta">{service.name}</span>, {service.durationMinutes} min, {formatBRL(service.priceCents)}.{" "}
      <Link
        href={bookingHref({ profissional: professionalMatches ? professional?.id : undefined })}
        className="font-semibold text-quaresmeira-700 hover:underline"
      >
        Trocar
      </Link>
    </p>
  );

  // Etapa 2 — profissional
  if (!professional || !professionalMatches) {
    const professionals = (await listPublicProfessionals(service.specialty)).filter((item) => item.hasSchedule);
    const nextSlots = new Map(
      await Promise.all(
        professionals.map(async (item) => {
          const availability = await getAvailabilityForBooking({ professionalId: item.id, serviceId: service.id });
          return [item.id, availability.days[0]?.slots[0]?.startsAt ?? null] as const;
        }),
      ),
    );
    return (
      <>
        {header}
        <BookingStepper current={2} links={["/paciente/agendar", null, null, null]} />
        <div className="mb-6">{serviceSummary}</div>
        {professionals.length > 0 ? (
          <ProfessionalChooser professionals={professionals} serviceId={service.id} nextSlots={nextSlots} />
        ) : (
          <EmptyState icon={<CalendarX2 className="size-5" aria-hidden />} title="Nenhum profissional com agenda aberta para este atendimento">
            Escolha outro tipo de atendimento ou fale com a clínica.
          </EmptyState>
        )}
      </>
    );
  }

  const availability = await getAvailabilityForBooking({ professionalId: professional.id, serviceId: service.id });
  const stepLinks = [
    "/paciente/agendar",
    bookingHref({ servico: service.id }),
    bookingHref({ servico: service.id, profissional: professional.id }),
    null,
  ];
  const professionalSummary = (
    <div className="flex items-center gap-3">
      <Avatar monogram={monogramOf(professional.displayName)} tone={specialtyTone(professional.specialty)} />
      <div>
        <p className="font-semibold">{professional.displayName}</p>
        <p className="text-sm text-pedra">
          {professional.title}, {professional.registry}.{" "}
          <Link href={bookingHref({ servico: service.id })} className="font-semibold text-quaresmeira-700 hover:underline">
            Trocar
          </Link>
        </p>
      </div>
    </div>
  );

  const normalizedSlot = slotParam && !Number.isNaN(new Date(slotParam).getTime()) ? new Date(slotParam).toISOString() : null;
  const slotStillFree = normalizedSlot ? availability.days.some((day) => day.slots.some((slot) => slot.startsAt === normalizedSlot)) : false;

  // Etapa 4 — confirmação
  if (normalizedSlot && slotStillFree) {
    const startsAt = new Date(normalizedSlot);
    const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
    const [names, policy] = await Promise.all([
      resolveDisplayNames(professional.id, [actor.patientId]),
      describePolicyForProfessional(actor.patientId, professional.id),
    ]);
    const me = names.get(actor.patientId);

    return (
      <>
        {header}
        <BookingStepper current={4} links={stepLinks} />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
          <Panel title="Resumo" className="h-fit">
            <div className="space-y-5">
              {professionalSummary}
              <ul className="space-y-3 text-[0.98rem]">
                <li className="flex gap-3">
                  <Clock className="mt-0.5 size-5 shrink-0 text-quaresmeira-600" aria-hidden />
                  <span>
                    <span className="block font-semibold">{capitalize(formatWeekdayLong(startsAt))}</span>
                    <span className="text-pedra">
                      {formatTime(startsAt)} às {formatTime(endsAt)} ({service.durationMinutes} min).{" "}
                      <Link
                        href={bookingHref({ servico: service.id, profissional: professional.id, dia: dayParam })}
                        className="font-semibold text-quaresmeira-700 hover:underline"
                      >
                        Trocar horário
                      </Link>
                    </span>
                  </span>
                </li>
                <li className="flex gap-3">
                  <Monitor className="mt-0.5 size-5 shrink-0 text-quaresmeira-600" aria-hidden />
                  <span>{service.name}</span>
                </li>
                <li className="flex gap-3">
                  <Wallet className="mt-0.5 size-5 shrink-0 text-quaresmeira-600" aria-hidden />
                  <span>
                    <span className="font-semibold">{formatBRL(service.priceCents)}</span>
                    <span className="block text-sm text-pedra">Pago no dia da consulta. Cancelamento sem custo até 24h antes.</span>
                  </span>
                </li>
              </ul>
            </div>
          </Panel>
          <Panel title="Detalhes do atendimento">
            <BookingConfirmForm
              serviceId={service.id}
              professionalId={professional.id}
              startsAt={normalizedSlot}
              professionalName={professional.displayName}
              acceptsOnline={professional.acceptsOnline}
              acceptsInPerson={professional.acceptsInPerson}
              privacy={{
                displayName: me?.displayName ?? "Paciente",
                presetLabel: presetLabel(policy.preset),
                hasOverride: policy.hasOverride,
              }}
            />
          </Panel>
        </div>
      </>
    );
  }

  // Etapa 3 — dia e horário
  const selectedDay = availability.days.find((day) => day.dateKey === dayParam) ?? availability.days[0];
  return (
    <>
      {header}
      <BookingStepper current={3} links={stepLinks} />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {professionalSummary}
        {serviceSummary}
      </div>
      {normalizedSlot && !slotStillFree && (
        <Callout tone="warning" className="mb-6" title="Esse horário não está mais disponível">
          Alguém acabou de reservá-lo ou ele saiu da agenda. Escolha outro horário abaixo.
        </Callout>
      )}
      {selectedDay ? (
        <Panel>
          <SlotPicker days={availability.days} selectedDay={selectedDay} base={{ servico: service.id, profissional: professional.id }} />
        </Panel>
      ) : (
        <EmptyState
          icon={<CalendarX2 className="size-5" aria-hidden />}
          title="Sem horários livres nas próximas semanas"
          action={
            <ButtonLink href={bookingHref({ servico: service.id })} variant="secondary">
              Ver outros profissionais
            </ButtonLink>
          }
        >
          A agenda deste profissional está cheia. Escolha outro profissional ou volte mais tarde: horários cancelados voltam a aparecer aqui.
        </EmptyState>
      )}
    </>
  );
}
