import { Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ServiceSummary } from "@/modules/catalog/application/catalog-service";
import { SPECIALTY_LABELS, type Specialty } from "@/modules/clinical-records/domain/record-access";
import type { PublicProfessional } from "@/modules/identity/application/directory-service";
import { cn } from "@/shared/lib/cn";
import { capitalize, dateKeyParts, formatDateKeyLong, relativeDayLabel, formatTime } from "@/shared/lib/datetime";
import { formatBRL } from "@/shared/lib/money";
import { Avatar, specialtyTone } from "@/shared/ui/avatar";
import type { AvailabilityDay } from "../../application/availability-service";

export type BookingParams = { servico?: string; profissional?: string; dia?: string; horario?: string };

export function bookingHref(params: BookingParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  const text = query.toString();
  return `/paciente/agendar${text ? `?${text}` : ""}`;
}

const STEPS = ["Atendimento", "Profissional", "Horário", "Confirmação"] as const;

/** Etapas do agendamento (sequência real, por isso numeradas). */
export function BookingStepper({ current, links }: { current: 1 | 2 | 3 | 4; links: (string | null)[] }) {
  return (
    <nav aria-label="Etapas do agendamento" className="mb-8">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
        {STEPS.map((label, index) => {
          const step = index + 1;
          const done = step < current;
          const active = step === current;
          const href = links[index];
          const content = (
            <>
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-full text-sm font-bold",
                  done && "bg-folha-600 text-white",
                  active && "bg-quaresmeira-700 text-white",
                  !done && !active && "bg-nevoa-escura text-pedra",
                )}
              >
                {done ? <Check className="size-4" aria-hidden /> : step}
              </span>
              <span className={cn("text-[0.95rem] font-semibold", active ? "text-tinta" : "text-pedra")}>{label}</span>
            </>
          );
          return (
            <li key={label} className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
              {done && href ? (
                <Link href={href} className="flex items-center gap-2 rounded-lg pr-1 hover:underline">
                  {content}
                </Link>
              ) : (
                <span className="flex items-center gap-2">{content}</span>
              )}
              {step < STEPS.length && <ChevronRight className="size-4 text-linha-forte" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Etapa 1: tipo de atendimento, agrupado por especialidade. */
export function ServiceChooser({ services, professionalId }: { services: ServiceSummary[]; professionalId?: string }) {
  const specialties: Specialty[] = ["PSYCHOLOGY", "PSYCHIATRY"];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {specialties.map((specialty) => {
        const items = services.filter((service) => service.specialty === specialty);
        if (items.length === 0) return null;
        return (
          <section key={specialty} aria-labelledby={`servicos-${specialty}`} className="space-y-3">
            <h2 id={`servicos-${specialty}`} className="flex items-center gap-2 text-lg font-bold">
              <span className={cn("size-2.5 rounded-full", specialty === "PSYCHIATRY" ? "bg-folha-500" : "bg-quaresmeira-500")} aria-hidden />
              {SPECIALTY_LABELS[specialty]}
            </h2>
            <ul className="space-y-2.5">
              {items.map((service) => (
                <li key={service.id}>
                  <Link
                    href={bookingHref({ servico: service.id, profissional: professionalId })}
                    className="group flex items-center gap-4 rounded-[1.25rem] border border-linha bg-papel p-4 transition-colors hover:border-quaresmeira-300 hover:bg-quaresmeira-50/40 sm:p-5"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-bold">{service.name}</p>
                      <p className="text-[0.95rem] text-pedra">{service.description}</p>
                      <p className="text-sm text-pedra">
                        {service.durationMinutes} min, <span className="font-semibold text-tinta">{formatBRL(service.priceCents)}</span>
                      </p>
                    </div>
                    <ChevronRight className="size-5 shrink-0 text-quaresmeira-600 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function monogramOf(name: string): string {
  const parts = name.replace(/^(Dra?\.)\s+/i, "").split(/\s+/);
  return ((parts[0]?.charAt(0) ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : "")).toUpperCase();
}

/** Etapa 2: profissionais da especialidade, com o próximo horário livre de cada um. */
export function ProfessionalChooser({
  professionals,
  serviceId,
  nextSlots,
}: {
  professionals: PublicProfessional[];
  serviceId: string;
  nextSlots: Map<string, string | null>;
}) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {professionals.map((professional) => {
        const next = nextSlots.get(professional.id) ?? null;
        return (
          <li key={professional.id}>
            <Link
              href={bookingHref({ servico: serviceId, profissional: professional.id })}
              className="group flex h-full gap-4 rounded-[1.25rem] border border-linha bg-papel p-5 transition-colors hover:border-quaresmeira-300"
            >
              <Avatar monogram={monogramOf(professional.displayName)} tone={specialtyTone(professional.specialty)} size="lg" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="font-bold">{professional.displayName}</p>
                <p className="text-sm text-pedra">
                  {professional.title}, {professional.registry}
                </p>
                {professional.focusAreas.length > 0 && <p className="text-sm">{professional.focusAreas.slice(0, 4).join(", ")}</p>}
                <p className={cn("text-sm font-semibold", next ? "text-folha-700" : "text-pedra")}>
                  {next ? `Próximo horário livre: ${relativeDayLabel(next).toLowerCase()}, ${formatTime(next)}` : "Sem horários livres no momento"}
                </p>
              </div>
              <ChevronRight className="mt-1 size-5 shrink-0 text-quaresmeira-600" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function periodOf(time: string): "Manhã" | "Tarde" | "Noite" {
  const hour = Number(time.slice(0, 2));
  if (hour < 12) return "Manhã";
  if (hour < 18) return "Tarde";
  return "Noite";
}

/** Etapa 3: dias com horários livres e os horários do dia escolhido. */
export function SlotPicker({ days, selectedDay, base }: { days: AvailabilityDay[]; selectedDay: AvailabilityDay; base: BookingParams }) {
  const periods = (["Manhã", "Tarde", "Noite"] as const)
    .map((period) => ({ period, slots: selectedDay.slots.filter((slot) => periodOf(slot.time) === period) }))
    .filter((group) => group.slots.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 text-lg font-bold">Escolha o dia</h2>
        <ul className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2" aria-label="Dias com horários livres">
          {days.map((day) => {
            const parts = dateKeyParts(day.dateKey);
            const active = day.dateKey === selectedDay.dateKey;
            return (
              <li key={day.dateKey} className="snap-start">
                <Link
                  href={bookingHref({ ...base, dia: day.dateKey })}
                  scroll={false}
                  aria-current={active ? "date" : undefined}
                  className={cn(
                    "flex w-[4.75rem] flex-col items-center rounded-2xl border px-2 py-2.5 leading-none transition-colors",
                    active ? "border-quaresmeira-700 bg-quaresmeira-700 text-white" : "border-linha bg-papel hover:border-quaresmeira-300",
                  )}
                >
                  <span className="text-xs font-semibold">{parts.weekday}</span>
                  <span className="my-1 text-2xl font-extrabold">{parts.day}</span>
                  <span className="text-xs font-semibold">{parts.month}</span>
                  <span className={cn("mt-1.5 text-[0.7rem] font-semibold", active ? "text-quaresmeira-100" : "text-folha-700")}>
                    {day.slots.length} {day.slots.length === 1 ? "livre" : "livres"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="space-y-5">
        <h2 className="text-lg font-bold">{capitalize(formatDateKeyLong(selectedDay.dateKey))}</h2>
        {periods.map((group) => (
          <div key={group.period} className="space-y-2.5">
            <p className="text-sm font-bold text-pedra">{group.period}</p>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
              {group.slots.map((slot) => (
                <li key={slot.startsAt}>
                  <Link
                    href={bookingHref({ ...base, dia: selectedDay.dateKey, horario: slot.startsAt })}
                    className="block rounded-xl border border-linha-forte bg-papel py-2.5 text-center font-bold transition-colors hover:border-quaresmeira-500 hover:bg-quaresmeira-50"
                  >
                    {slot.time}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
