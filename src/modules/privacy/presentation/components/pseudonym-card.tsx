"use client";

import { Shuffle } from "lucide-react";
import { useActionState } from "react";
import { regeneratePseudonymAction } from "@/modules/identity/presentation/actions";
import { INITIAL_ACTION_STATE } from "@/shared/lib/action-state";
import { FormMessage } from "@/shared/ui/form-message";
import { SubmitButton } from "@/shared/ui/submit-button";

/** Codinome usado no modo anônimo, com opção de sortear outro. */
export function PseudonymCard({ pseudonym }: { pseudonym: string }) {
  const [state, formAction] = useActionState(regeneratePseudonymAction, INITIAL_ACTION_STATE);
  return (
    <section aria-labelledby="codinome" className="space-y-3 rounded-[1.25rem] border border-linha bg-papel p-5 sm:p-6">
      <h2 id="codinome" className="text-lg font-bold">
        Seu codinome
      </h2>
      <p className="text-[1.6rem] font-extrabold tracking-[-0.02em] text-quaresmeira-800">{pseudonym}</p>
      <p className="text-sm text-pedra">
        É assim que você aparece para quem vê seu nome como “Codinome”. Ele é sorteado entre nomes de árvores brasileiras e não carrega nenhuma
        informação sobre você.
      </p>
      <FormMessage state={state} />
      <form action={formAction}>
        <SubmitButton variant="secondary" size="sm" pendingLabel="Sorteando…">
          <Shuffle className="size-4" aria-hidden />
          Sortear outro codinome
        </SubmitButton>
      </form>
    </section>
  );
}
