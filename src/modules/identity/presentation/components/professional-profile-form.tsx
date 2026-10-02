"use client";

import { useActionState } from "react";
import { INITIAL_ACTION_STATE, fieldError, valueOf } from "@/shared/lib/action-state";
import { describedBy, Field, Input, Textarea } from "@/shared/ui/form";
import { FormMessage } from "@/shared/ui/form-message";
import { SubmitButton } from "@/shared/ui/submit-button";
import { updateProfessionalProfileAction } from "../actions";

/** Apresentação do profissional no site e na escolha de profissional. */
export function ProfessionalProfileForm({ bio, focusAreas }: { bio: string; focusAreas: string[] }) {
  const [state, formAction] = useActionState(updateProfessionalProfileAction, INITIAL_ACTION_STATE);
  const errors = (field: string) => fieldError(state, field);
  return (
    <form action={formAction} className="space-y-5">
      <FormMessage state={state} />
      <div key={state.at ?? 0} className="space-y-5">
        <Field
          label="Sobre você"
          htmlFor="bio"
          errors={errors("bio")}
          hint="Como você trabalha e quem você costuma atender. Escreva para quem está chegando pela primeira vez."
        >
          <Textarea
            id="bio"
            name="bio"
            maxLength={800}
            defaultValue={valueOf(state, "bio", bio)}
            className="min-h-32"
            {...describedBy("bio", errors("bio"), true)}
          />
        </Field>
        <Field
          label="Áreas de atuação"
          htmlFor="focusAreas"
          errors={errors("focusAreas")}
          hint="Separe por vírgulas. Até 8 áreas, ex.: ansiedade, luto, TDAH em adultos."
        >
          <Input
            id="focusAreas"
            name="focusAreas"
            maxLength={300}
            defaultValue={valueOf(state, "focusAreas", focusAreas.join(", "))}
            {...describedBy("focusAreas", errors("focusAreas"), true)}
          />
        </Field>
      </div>
      <SubmitButton pendingLabel="Salvando…">Salvar apresentação</SubmitButton>
    </form>
  );
}
