"use client";

import { Lock } from "lucide-react";
import { useActionState, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { INITIAL_ACTION_STATE, fieldError, valueOf, type ActionState } from "@/shared/lib/action-state";
import { describedBy, Field, Select, Textarea } from "@/shared/ui/form";
import { FormMessage } from "@/shared/ui/form-message";
import { SubmitButton } from "@/shared/ui/submit-button";
import {
  RECORD_MAX_LENGTH,
  RECORD_TYPES,
  VISIBILITY_OPTIONS,
  recordTypesFor,
  type RecordType,
  type RecordVisibility,
  type Specialty,
} from "../../domain/record-access";
import { addClinicalRecordAction } from "../actions";

type AppointmentOption = { id: string; label: string };

type Props = {
  patientId: string;
  specialty: Specialty;
  appointments: AppointmentOption[];
  defaultAppointmentId?: string;
  patientDisplayName: string;
};

/** Nova anotação no prontuário. */
export function RecordForm({ patientId, specialty, appointments, defaultAppointmentId, patientDisplayName }: Props) {
  const [length, setLength] = useState(0);
  const [state, formAction] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await addClinicalRecordAction(previous, formData);
    if (result.status === "success") setLength(0);
    return result;
  }, INITIAL_ACTION_STATE);
  const types = recordTypesFor(specialty);
  const [type, setType] = useState<RecordType>("EVOLUTION");
  const [visibility, setVisibility] = useState<RecordVisibility>("CARE_TEAM");
  const errors = (field: string) => fieldError(state, field);

  return (
    <form action={formAction} className="space-y-5" key={state.status === "success" ? state.at : "registro"}>
      <input type="hidden" name="patientId" value={patientId} />
      <FormMessage state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo de registro" htmlFor="type" errors={errors("type")} hint={RECORD_TYPES[type].hint}>
          <Select
            id="type"
            name="type"
            value={type}
            onChange={(event) => setType(event.target.value as RecordType)}
            {...describedBy("type", errors("type"), true)}
          >
            {types.map((key) => (
              <option key={key} value={key}>
                {RECORD_TYPES[key].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Consulta relacionada" htmlFor="appointmentId" optional errors={errors("appointmentId")}>
          <Select id="appointmentId" name="appointmentId" defaultValue={valueOf(state, "appointmentId", defaultAppointmentId ?? "")}>
            <option value="">Sem consulta específica</option>
            {appointments.map((appointment) => (
              <option key={appointment.id} value={appointment.id}>
                {appointment.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label="Anotação"
        htmlFor="content"
        errors={errors("content")}
        hint={`O prontuário segue para outros profissionais, e cada um vê ${patientDisplayName} do jeito que o paciente escolheu. Por isso, evite registrar dados de identificação, como nome completo, endereço ou documentos.`}
      >
        <Textarea
          id="content"
          name="content"
          required
          maxLength={RECORD_MAX_LENGTH}
          defaultValue={valueOf(state, "content")}
          onChange={(event) => setLength(event.target.value.length)}
          className="min-h-44"
          {...describedBy("content", errors("content"), true)}
        />
      </Field>
      <p className="-mt-3 text-right text-xs text-pedra">
        {length.toLocaleString("pt-BR")} / {RECORD_MAX_LENGTH.toLocaleString("pt-BR")}
      </p>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold">Quem pode ler</legend>
        {(Object.keys(VISIBILITY_OPTIONS) as RecordVisibility[]).map((key) => (
          <label
            key={key}
            className={cn(
              "flex cursor-pointer gap-3 rounded-2xl border p-3.5 transition-colors",
              visibility === key ? "border-quaresmeira-500 bg-quaresmeira-50/60" : "border-linha hover:border-quaresmeira-300",
            )}
          >
            <input
              type="radio"
              name="visibility"
              value={key}
              checked={visibility === key}
              onChange={() => setVisibility(key)}
              className="mt-1 size-4 accent-quaresmeira-700"
            />
            <span>
              <span className="block font-semibold">{VISIBILITY_OPTIONS[key].label}</span>
              <span className="block text-sm text-pedra">{VISIBILITY_OPTIONS[key].hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <p className="flex gap-2 text-sm text-pedra">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />O paciente não vê o prontuário pelo app. Registros não podem ser editados nem apagados
        depois de salvos; para corrigir, faça uma nova anotação.
      </p>

      <SubmitButton pendingLabel="Salvando…">Salvar no prontuário</SubmitButton>
    </form>
  );
}
