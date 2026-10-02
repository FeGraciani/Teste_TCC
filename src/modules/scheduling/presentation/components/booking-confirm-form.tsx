"use client";

import { Monitor, MapPin, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { INITIAL_ACTION_STATE, fieldError, valueOf } from "@/shared/lib/action-state";
import { describedBy, Field, Textarea } from "@/shared/ui/form";
import { FormMessage } from "@/shared/ui/form-message";
import { SubmitButton } from "@/shared/ui/submit-button";
import { bookAppointmentAction } from "../actions";

type Props = {
  serviceId: string;
  professionalId: string;
  startsAt: string;
  professionalName: string;
  acceptsOnline: boolean;
  acceptsInPerson: boolean;
  /** Como este profissional verá o paciente, segundo as preferências atuais. */
  privacy: { displayName: string; presetLabel: string; hasOverride: boolean };
};

export function BookingConfirmForm({ serviceId, professionalId, startsAt, professionalName, acceptsOnline, acceptsInPerson, privacy }: Props) {
  const [state, formAction] = useActionState(bookAppointmentAction, INITIAL_ACTION_STATE);
  const initialModality = valueOf(state, "modality", acceptsOnline ? "ONLINE" : "IN_PERSON");
  const [modality, setModality] = useState(initialModality);

  const options = [
    { value: "ONLINE", label: "Online", hint: "Por vídeo, de onde você estiver", icon: Monitor, enabled: acceptsOnline },
    { value: "IN_PERSON", label: "Presencial", hint: "No consultório, na Vila Madalena", icon: MapPin, enabled: acceptsInPerson },
  ].filter((option) => option.enabled);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="professionalId" value={professionalId} />
      <input type="hidden" name="startsAt" value={startsAt} />

      <FormMessage state={state} />

      <fieldset className="space-y-2.5">
        <legend className="mb-2.5 text-sm font-semibold">Como prefere ser atendido?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-2xl border bg-papel p-4 transition-colors",
                modality === option.value ? "border-quaresmeira-500 ring-3 ring-quaresmeira-100" : "border-linha-forte hover:border-quaresmeira-300",
              )}
            >
              <input
                type="radio"
                name="modality"
                value={option.value}
                checked={modality === option.value}
                onChange={() => setModality(option.value)}
                className="size-4 accent-quaresmeira-700"
              />
              <option.icon className="size-5 text-quaresmeira-600" aria-hidden />
              <span>
                <span className="block font-semibold">{option.label}</span>
                <span className="block text-sm text-pedra">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        label="Quer deixar um recado para o profissional?"
        htmlFor="note"
        optional
        errors={fieldError(state, "note")}
        hint="Visível para o profissional. Não precisa contar detalhes agora; vocês conversam na consulta."
      >
        <Textarea
          id="note"
          name="note"
          maxLength={500}
          defaultValue={valueOf(state, "note")}
          key={`note-${state.at ?? 0}`}
          placeholder="Ex.: é minha primeira vez em terapia."
          {...describedBy("note", fieldError(state, "note"), true)}
        />
      </Field>

      <div className="flex gap-3 rounded-2xl bg-quaresmeira-50 p-4 ring-1 ring-inset ring-quaresmeira-200">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-quaresmeira-700" aria-hidden />
        <div className="space-y-1 text-[0.95rem] text-quaresmeira-900">
          <p>
            {professionalName} vai ver você como <strong className="font-bold">{privacy.displayName}</strong> (modo{" "}
            {privacy.presetLabel.toLowerCase()}
            {privacy.hasOverride ? ", configuração exclusiva para este profissional" : ""}).
          </p>
          <Link href={`/paciente/privacidade?profissional=${professionalId}`} className="font-semibold underline">
            Ajustar o que este profissional vê
          </Link>
        </div>
      </div>

      <SubmitButton size="lg" className="w-full sm:w-auto" pendingLabel="Reservando seu horário…">
        Confirmar agendamento
      </SubmitButton>
    </form>
  );
}
