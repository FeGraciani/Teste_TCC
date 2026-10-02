import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

const controlBase =
  "w-full rounded-xl border border-linha-forte bg-papel px-3.5 text-[0.95rem] text-tinta placeholder:text-pedra/70 " +
  "transition-colors hover:border-quaresmeira-300 focus:border-quaresmeira-500 focus:outline-none focus:ring-3 focus:ring-quaresmeira-100 " +
  "disabled:bg-nevoa disabled:text-pedra aria-invalid:border-urucum-600 aria-invalid:ring-urucum-100";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlBase, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(controlBase, "min-h-28 py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(controlBase, "h-11 appearance-none bg-[length:1rem] bg-[right_0.85rem_center] bg-no-repeat pr-9", selectArrow, className)}
      {...props}
    >
      {children}
    </select>
  );
}

const selectArrow =
  "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23625e74' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("block text-sm font-semibold text-tinta", className)} {...props} />;
}

type FieldProps = {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  errors?: string[];
  optional?: boolean;
  className?: string;
  children: ReactNode;
};

/** Rótulo + controle + dica + erro, com ids ligados para leitores de tela. */
export function Field({ label, htmlFor, hint, errors, optional, className, children }: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {optional && <span className="ml-1.5 font-normal text-pedra">(opcional)</span>}
      </Label>
      {children}
      {hint && !errors?.length && (
        <p id={`${htmlFor}-hint`} className="text-sm text-pedra">
          {hint}
        </p>
      )}
      {errors?.length ? (
        <p id={`${htmlFor}-error`} className="text-sm font-medium text-urucum-700" role="alert">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}

export function describedBy(id: string, errors?: string[], hint?: boolean) {
  if (errors?.length) return { "aria-invalid": true as const, "aria-describedby": `${id}-error` };
  return hint ? { "aria-describedby": `${id}-hint` } : {};
}
