"use client";

import { LoaderCircle } from "lucide-react";
import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { buttonClasses } from "./button";

type Props = Omit<ComponentProps<"button">, "type"> & {
  variant?: Parameters<typeof buttonClasses>[0];
  size?: Parameters<typeof buttonClasses>[1];
  pendingLabel?: string;
};

/** Botão de envio que mostra o estado de carregamento do formulário. */
export function SubmitButton({ variant = "primary", size = "md", className, children, pendingLabel, disabled, ...props }: Props) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={buttonClasses(variant, size, className)} disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
