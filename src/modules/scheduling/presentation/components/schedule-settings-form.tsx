"use client";

import { useActionState } from "react";
import { INITIAL_ACTION_STATE, fieldError, valueOf } from "@/shared/lib/action-state";
import { describedBy, Field, Input, Select } from "@/shared/ui/form";
import { FormMessage } from "@/shared/ui/form-message";
import { SubmitButton } from "@/shared/ui/submit-button";
import type { ScheduleRules } from "../../application/availability-service";
import { saveScheduleSettingsAction } from "../actions";

const STEPS = [15, 20, 30, 45, 60, 90];

/** Regras que definem quais horários aparecem para os pacientes. */
export function ScheduleSettingsForm({
  rules,
  acceptsOnline,
  acceptsInPerson,
}: {
  rules: ScheduleRules;
  acceptsOnline: boolean;
  acceptsInPerson: boolean;
}) {
  const [state, formAction] = useActionState(saveScheduleSettingsAction, INITIAL_ACTION_STATE);
  const errors = (field: string) => fieldError(state, field);
  const checked = (field: "acceptsOnline" | "acceptsInPerson", saved: boolean) => (state.values ? state.values[field] === "on" : saved);

  return (
    <form action={formAction} className="space-y-5">
      <FormMessage state={state} />
      <div key={state.at ?? 0} className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Novos horários a cada"
          htmlFor="slotStepMinutes"
          errors={errors("slotStepMinutes")}
          hint="Ex.: de hora em hora (9h, 10h, 11h…)."
        >
          <Select id="slotStepMinutes" name="slotStepMinutes" defaultValue={valueOf(state, "slotStepMinutes", String(rules.slotStepMinutes))}>
            {STEPS.map((step) => (
              <option key={step} value={step}>
                {step < 60 ? `${step} minutos` : step === 60 ? "1 hora" : "1 hora e meia"}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Intervalo entre consultas (minutos)"
          htmlFor="bufferMinutes"
          errors={errors("bufferMinutes")}
          hint="Tempo livre depois de cada atendimento."
        >
          <Input
            id="bufferMinutes"
            name="bufferMinutes"
            type="number"
            min={0}
            max={120}
            defaultValue={valueOf(state, "bufferMinutes", String(rules.bufferMinutes))}
            {...describedBy("bufferMinutes", errors("bufferMinutes"), true)}
          />
        </Field>
        <Field
          label="Antecedência mínima (horas)"
          htmlFor="minNoticeHours"
          errors={errors("minNoticeHours")}
          hint="Pacientes não conseguem agendar em cima da hora."
        >
          <Input
            id="minNoticeHours"
            name="minNoticeHours"
            type="number"
            min={0}
            max={720}
            defaultValue={valueOf(state, "minNoticeHours", String(rules.minNoticeHours))}
            {...describedBy("minNoticeHours", errors("minNoticeHours"), true)}
          />
        </Field>
        <Field
          label="Agenda aberta por (dias)"
          htmlFor="bookingWindowDays"
          errors={errors("bookingWindowDays")}
          hint="Até quantos dias à frente os pacientes podem agendar."
        >
          <Input
            id="bookingWindowDays"
            name="bookingWindowDays"
            type="number"
            min={7}
            max={180}
            defaultValue={valueOf(state, "bookingWindowDays", String(rules.bookingWindowDays))}
            {...describedBy("bookingWindowDays", errors("bookingWindowDays"), true)}
          />
        </Field>
        <fieldset className="space-y-2 sm:col-span-2">
          <legend className="text-sm font-semibold">Modalidades que você oferece</legend>
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              name="acceptsOnline"
              defaultChecked={checked("acceptsOnline", acceptsOnline)}
              className="size-4 accent-quaresmeira-700"
            />
            Online
          </label>
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              name="acceptsInPerson"
              defaultChecked={checked("acceptsInPerson", acceptsInPerson)}
              className="size-4 accent-quaresmeira-700"
            />
            Presencial
          </label>
          {errors("acceptsOnline") && <p className="text-sm font-medium text-urucum-700">{errors("acceptsOnline")?.[0]}</p>}
        </fieldset>
      </div>
      <SubmitButton pendingLabel="Salvando…">Salvar regras</SubmitButton>
    </form>
  );
}
