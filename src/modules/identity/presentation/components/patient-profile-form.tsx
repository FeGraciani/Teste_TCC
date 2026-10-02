"use client";

import { useActionState, type ReactNode } from "react";
import { INITIAL_ACTION_STATE, fieldError, valueOf } from "@/shared/lib/action-state";
import { describedBy, Field, Input, Select, Textarea } from "@/shared/ui/form";
import { FormMessage } from "@/shared/ui/form-message";
import { SubmitButton } from "@/shared/ui/submit-button";
import type { PatientPersonalData } from "@/modules/privacy/domain/projection";
import { BRAZILIAN_STATES, formatPhone } from "../../domain/patient-profile";
import { updatePatientProfileAction } from "../actions";

function formatCpfInput(value: string | null): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 ? `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}` : value;
}

type TextOptions = {
  hint?: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  inputMode?: "numeric" | "tel" | "text";
};

/** Dados completos do paciente. O que cada profissional vê é definido em Privacidade. */
export function PatientProfileForm({ profile }: { profile: PatientPersonalData }) {
  const [state, formAction] = useActionState(updatePatientProfileAction, INITIAL_ACTION_STATE);
  const errors = (field: string) => fieldError(state, field);

  /** Campo de texto: `name` é o nome enviado ao servidor; `saved` é o valor guardado hoje. */
  const text = (name: string, label: string, saved: string | null, options: TextOptions = {}) => (
    <Field label={label} htmlFor={name} hint={options.hint} errors={errors(name)} optional={!options.required}>
      <Input
        id={name}
        name={name}
        type={options.type ?? "text"}
        autoComplete={options.autoComplete}
        inputMode={options.inputMode}
        required={options.required}
        defaultValue={valueOf(state, name, saved)}
        {...describedBy(name, errors(name), Boolean(options.hint))}
      />
    </Field>
  );

  const area = (name: string, label: string, saved: string | null, hint?: string) => (
    <Field label={label} htmlFor={name} hint={hint} errors={errors(name)} optional>
      <Textarea id={name} name={name} defaultValue={valueOf(state, name, saved)} {...describedBy(name, errors(name), Boolean(hint))} />
    </Field>
  );

  return (
    <form action={formAction} className="space-y-6">
      <FormMessage state={state} />
      <div key={state.at ?? 0} className="space-y-6">
        <Group title="Identificação" description="Seu nome completo fica com a clínica para recibos e documentos.">
          <div className="grid gap-5 sm:grid-cols-2">
            {text("name", "Nome completo", profile.fullName, { autoComplete: "name", required: true })}
            {text("preferredName", "Como prefere ser chamado(a)", profile.preferredName, { hint: "Nome social ou apelido." })}
            {text("birthDate", "Data de nascimento", profile.birthDate, { type: "date", autoComplete: "bday", required: true })}
            {text("cpf", "CPF", formatCpfInput(profile.cpf), { inputMode: "numeric", hint: "Necessário para algumas receitas e recibos." })}
            {text("gender", "Gênero", profile.gender)}
            {text("pronouns", "Pronomes", profile.pronouns, { hint: "Ex.: ela/dela, ele/dele, elu/delu." })}
          </div>
        </Group>

        <Group title="Contato e endereço">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="E-mail" htmlFor="email-readonly" hint="Para trocar o e-mail de acesso, fale com a clínica.">
              <Input id="email-readonly" value={profile.email} readOnly disabled />
            </Field>
            {text("phone", "Telefone com DDD", formatPhone(profile.phone), { type: "tel", autoComplete: "tel", inputMode: "tel" })}
            {text("city", "Cidade", profile.city, { autoComplete: "address-level2" })}
            <Field label="Estado" htmlFor="state" errors={errors("state")} optional>
              <Select id="state" name="state" defaultValue={valueOf(state, "state", profile.state)} {...describedBy("state", errors("state"))}>
                <option value="">Selecione</option>
                {BRAZILIAN_STATES.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {text("address", "Endereço", profile.address, { autoComplete: "street-address" })}
          {text("emergencyContact", "Contato de emergência", profile.emergencyContact, {
            hint: "Nome, relação e telefone. Ex.: Ana (irmã), (11) 97777-6666.",
          })}
        </Group>

        <Group title="Sobre você">
          <div className="grid gap-5 sm:grid-cols-2">
            {text("occupation", "Profissão", profile.occupation)}
            {text("maritalStatus", "Estado civil", profile.maritalStatus)}
          </div>
        </Group>

        <Group title="Informações de saúde" description="Ajudam o profissional a cuidar melhor de você. Ficam criptografadas.">
          {area("mainComplaint", "O que trouxe você até aqui", profile.mainComplaint, "Escreva com suas palavras, do tamanho que quiser.")}
          {area("medications", "Medicações em uso", profile.medications, "Nome, dose e horário, se souber.")}
          {area("allergies", "Alergias", profile.allergies)}
          {area("healthHistory", "Histórico de saúde", profile.healthHistory, "Diagnósticos, tratamentos e internações anteriores.")}
        </Group>
      </div>

      <div className="sticky bottom-3 z-10 flex justify-end rounded-2xl border border-linha bg-papel/95 p-3 shadow-flutuante backdrop-blur">
        <SubmitButton pendingLabel="Salvando…">Salvar meus dados</SubmitButton>
      </div>
    </form>
  );
}

function Group({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-5 rounded-[1.25rem] border border-linha bg-papel p-5 sm:p-6">
      <legend className="sr-only">{title}</legend>
      <div aria-hidden>
        <p className="text-lg font-bold">{title}</p>
        {description && <p className="text-sm text-pedra">{description}</p>}
      </div>
      {children}
    </fieldset>
  );
}
