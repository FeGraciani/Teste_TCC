"use client";

import { useActionState } from "react";
import { INITIAL_ACTION_STATE, fieldError, valueOf } from "@/shared/lib/action-state";
import { describedBy, Field, Input, Select, Textarea } from "@/shared/ui/form";
import { FormMessage } from "@/shared/ui/form-message";
import { SubmitButton } from "@/shared/ui/submit-button";
import { saveServiceAction } from "../actions";

type Service = {
  id: string;
  name: string;
  description: string;
  specialty: "PSYCHOLOGY" | "PSYCHIATRY";
  durationMinutes: number;
  priceCents: number;
  sortOrder: number;
  active: boolean;
};

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** Cria (sem `service`) ou edita um serviço e o seu valor. */
export function ServiceForm({ service }: { service?: Service }) {
  const [state, formAction] = useActionState(saveServiceAction, INITIAL_ACTION_STATE);
  const errors = (field: string) => fieldError(state, field);
  const prefix = service?.id ?? "novo";
  const id = (field: string) => `${prefix}-${field}`;

  return (
    <form action={formAction} className="space-y-5">
      {service && <input type="hidden" name="id" value={service.id} />}
      <FormMessage state={state} />
      <div key={state.at ?? 0} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Nome" htmlFor={id("name")} errors={errors("name")}>
            <Input
              id={id("name")}
              name="name"
              required
              defaultValue={valueOf(state, "name", service?.name)}
              {...describedBy(id("name"), errors("name"))}
            />
          </Field>
          <Field label="Especialidade" htmlFor={id("specialty")} errors={errors("specialty")}>
            <Select id={id("specialty")} name="specialty" defaultValue={valueOf(state, "specialty", service?.specialty ?? "PSYCHOLOGY")}>
              <option value="PSYCHOLOGY">Psicologia</option>
              <option value="PSYCHIATRY">Psiquiatria</option>
            </Select>
          </Field>
        </div>
        <Field label="Descrição (aparece no site)" htmlFor={id("description")} errors={errors("description")}>
          <Textarea
            id={id("description")}
            name="description"
            required
            maxLength={400}
            className="min-h-20"
            defaultValue={valueOf(state, "description", service?.description)}
            {...describedBy(id("description"), errors("description"))}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-4">
          <Field label="Valor (R$)" htmlFor={id("price")} errors={errors("price")}>
            <Input
              id={id("price")}
              name="price"
              inputMode="decimal"
              required
              defaultValue={valueOf(state, "price", service ? centsToInput(service.priceCents) : "")}
              placeholder="220,00"
              {...describedBy(id("price"), errors("price"))}
            />
          </Field>
          <Field label="Duração (min)" htmlFor={id("durationMinutes")} errors={errors("durationMinutes")}>
            <Input
              id={id("durationMinutes")}
              name="durationMinutes"
              type="number"
              min={15}
              max={240}
              required
              defaultValue={valueOf(state, "durationMinutes", String(service?.durationMinutes ?? 50))}
              {...describedBy(id("durationMinutes"), errors("durationMinutes"))}
            />
          </Field>
          <Field label="Ordem no site" htmlFor={id("sortOrder")} errors={errors("sortOrder")}>
            <Input
              id={id("sortOrder")}
              name="sortOrder"
              type="number"
              min={0}
              max={999}
              defaultValue={valueOf(state, "sortOrder", String(service?.sortOrder ?? 0))}
            />
          </Field>
          <Field label="Situação" htmlFor={id("active")}>
            <Select id={id("active")} name="active" defaultValue={valueOf(state, "active", service && !service.active ? "off" : "on")}>
              <option value="on">Ativo</option>
              <option value="off">Inativo (some do site)</option>
            </Select>
          </Field>
        </div>
      </div>
      <SubmitButton size="sm" pendingLabel="Salvando…">
        {service ? "Salvar serviço" : "Criar serviço"}
      </SubmitButton>
    </form>
  );
}
