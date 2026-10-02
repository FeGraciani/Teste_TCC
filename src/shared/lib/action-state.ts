/** Estado devolvido pelas Server Actions para os formulários. */
export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  /**
   * Valores enviados, devolvidos quando há erro: o React 19 limpa o formulário
   * depois de cada envio, e assim os campos voltam preenchidos (nunca senhas).
   */
  values?: Record<string, string>;
  /** Carimbo para que mensagens iguais em envios seguidos sejam percebidas como novas. */
  at?: number;
  /**
   * Só em desenvolvimento local sem SMTP: link de acesso (convite ou nova
   * senha) para testar o fluxo sem caixa de e-mail. Nunca vem em produção.
   */
  devLink?: string;
};

export const INITIAL_ACTION_STATE: ActionState = { status: "idle" };

/** Primeiro erro de um campo, para exibir abaixo do controle. */
export function fieldError(state: ActionState, field: string): string[] | undefined {
  return state.fieldErrors?.[field];
}

/** Valor a mostrar num campo: o que a pessoa acabou de enviar (se houve erro) ou o valor salvo. */
export function valueOf(state: ActionState, field: string, fallback: string | null | undefined = ""): string {
  return state.values?.[field] ?? fallback ?? "";
}
