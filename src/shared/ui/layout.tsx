import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4 pb-6 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="max-w-2xl space-y-1.5">
        <h1 className="text-[1.75rem] font-bold sm:text-[2rem]">{title}</h1>
        {description && <p className="text-[1.02rem] text-pedra">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/** Painel de conteúdo das áreas logadas. */
export function Panel({
  title,
  description,
  actions,
  className,
  children,
  as: Tag = "section",
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
  as?: "section" | "div" | "article";
}) {
  return (
    <Tag className={cn("rounded-[1.25rem] border border-linha bg-papel p-5 sm:p-6", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            {title && <h2 className="text-lg font-bold">{title}</h2>}
            {description && <p className="text-sm text-pedra">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </Tag>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-3 rounded-2xl border border-dashed border-linha-forte px-5 py-6", className)}>
      {icon && <div className="grid size-10 place-items-center rounded-full bg-quaresmeira-50 text-quaresmeira-700">{icon}</div>}
      <div className="space-y-1">
        <p className="font-semibold">{title}</p>
        {children && <div className="text-[0.95rem] text-pedra">{children}</div>}
      </div>
      {action}
    </div>
  );
}
