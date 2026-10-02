import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

type Variant = "primary" | "secondary" | "quiet" | "danger" | "danger-quiet" | "success";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-quaresmeira-700 text-white hover:bg-quaresmeira-800 active:bg-quaresmeira-900 shadow-suave",
  secondary: "bg-papel text-tinta ring-1 ring-inset ring-linha-forte hover:bg-quaresmeira-50 hover:ring-quaresmeira-300",
  quiet: "text-quaresmeira-700 hover:bg-quaresmeira-50",
  danger: "bg-urucum-600 text-white hover:bg-urucum-700 shadow-suave",
  "danger-quiet": "text-urucum-700 hover:bg-urucum-50",
  success: "bg-folha-700 text-white hover:bg-folha-800 shadow-suave",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5 rounded-lg",
  md: "h-11 px-5 text-[0.95rem] gap-2 rounded-xl",
  lg: "h-13 px-6 text-base gap-2 rounded-xl",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-colors",
    "disabled:pointer-events-none disabled:opacity-55",
    variants[variant],
    sizes[size],
    className,
  );
}

type ButtonProps = ComponentProps<"button"> & { variant?: Variant; size?: Size };

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size; children: ReactNode };

export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}

/** Link externo com aparência de botão (ex.: sala de atendimento online). */
export function ButtonAnchor({ variant, size, className, ...props }: ComponentProps<"a"> & { variant?: Variant; size?: Size }) {
  return <a className={buttonClasses(variant, size, className)} target="_blank" rel="noopener noreferrer" {...props} />;
}
