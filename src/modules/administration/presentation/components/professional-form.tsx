"use client";

import { useActionState } from "react";
import { INITIAL_ACTION_STATE, fieldError, valueOf } from "@/shared/lib/action-state";
import { Callout } from "@/shared/ui/callout";
import { describedBy, Field, Input, Select, Textarea } from "@/shared/ui/form";
import { FormMessage } from "@/shared/ui/form-message";
import { SubmitButton } from "@/shared/ui/submit-button";
import { createProfessionalAction, updateProfessionalAction } from "../actions";

type Professional = {
  professionalId: string;
  name: string;
  displayName: string;
  email: string;
  specialty: "PSYCHOLOGY" | "PSYCHIATRY";
  title: string;
  registry: string;
  bio: string;
  focusAreas: string[];
};

/** Cadastro (sem `professional`) ou edição de profissional pela administração. */
export function ProfessionalForm({ professional }: { professional?: Professional }) {
  const editing = Boolean(professional);
  const [state, formAction] = useActionState(editing ? updateProfessionalAction : createProfessionalAction, INITIAL_ACTION_STATE);
  const errors = (field: string) => fieldError(state, field);
  const value = (field: string, saved?: string) => valueOf(state, field, saved ?? "");

  return (
    <form action={formAction} className="space-y-6">
      {professional && <input type="hidden" name="professionalId" value={professional.professionalId} />}
      <FormMessage state={state} />
      <div key={state.at ?? 0} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Nome completo" htmlFor="name" errors={errors("name")}>
            <Input id="name" name="name" required defaultValue={value("name", professional?.name)} {...describedBy("name", errors("name"))} />
          </Field>
          <Field
            label="Nome de exibição"
            htmlFor="displayName"
            errors={errors("displayName")}
            hint="Como aparece para os pacientes. Ex.: Dra. Helena Duarte."
          >
            <Input
              id="displayName"
              name="displayName"
              required
              defaultValue={value("displayName", professional?.displayName)}
              {...describedBy("displayName", errors("displayName"), true)}
            />
          </Field>
          <Field label="E-mail de acesso" htmlFor="email" errors={errors("email")}>
            <Input
              id="email"
              name="email"
              type="email"
              required
              defaultValue={value("email", professional?.email)}
              {...describedBy("email", errors("email"))}
            />
          </Field>
          <Field label="Especialidade" htmlFor="specialty" errors={errors("specialty")}>
            <Select id="specialty" name="specialty" defaultValue={value("specialty", professional?.specialty ?? "PSYCHOLOGY")}>
              <option value="PSYCHOLOGY">Psicologia</option>
              <option value="PSYCHIATRY">Psiquiatria</option>
            </Select>
          </Field>
          <Field label="Título" htmlFor="title" errors={errors("title")} hint="Ex.: Psicóloga clínica, Psiquiatra.">
            <Input
              id="title"
              name="title"
              required
              defaultValue={value("title", professional?.title)}
              {...describedBy("title", errors("title"), true)}
            />
          </Field>
          <Field
            label="Registro no conselho"
            htmlFor="registry"
            errors={errors("registry")}
            hint="CRM-SP 123456 (psiquiatria) ou CRP 06/123456 (psicologia)."
          >
            <Input
              id="registry"
              name="registry"
              required
              defaultValue={value("registry", professional?.registry)}
              {...describedBy("registry", errors("registry"), true)}
            />
          </Field>
        </div>
        <Field label="Apresentação" htmlFor="bio" optional errors={errors("bio")} hint="O próprio profissional também pode editar depois.">
          <Textarea id="bio" name="bio" maxLength={800} defaultValue={value("bio", professional?.bio)} {...describedBy("bio", errors("bio"), true)} />
        </Field>
        <Field label="Áreas de atuação" htmlFor="focusAreas" optional errors={errors("focusAreas")} hint="Separe por vírgulas.">
          <Input
            id="focusAreas"
            name="focusAreas"
            defaultValue={value("focusAreas", professional?.focusAreas.join(", "))}
            {...describedBy("focusAreas", errors("focusAreas"), true)}
          />
        </Field>
        {!editing && (
          <Callout title="Como o profissional entra">
            Ele recebe no e-mail de acesso um convite para criar a própria senha (o link vale 7 dias). Ninguém da clínica define nem vê essa senha. A
            agenda já começa aberta de segunda a sexta, 8h–12h e 14h–18h, e ele ajusta em “Horários de trabalho”.
          </Callout>
        )}
      </div>
      <SubmitButton pendingLabel="Salvando…">{editing ? "Salvar alterações" : "Cadastrar profissional"}</SubmitButton>
    </form>
  );
}
