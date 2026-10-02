"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Janela modal acessível baseada no <dialog> nativo: foco preso,
 * Esc fecha, clique fora fecha.
 */
export function Dialog({ open, onClose, title, description, children, className }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={cn(
        "m-auto w-[min(34rem,calc(100vw-2rem))] max-w-none rounded-[1.5rem] bg-papel p-0 text-tinta shadow-flutuante backdrop:bg-tinta/45 backdrop:backdrop-blur-[2px]",
        className,
      )}
    >
      {open && (
        <div className="space-y-5 p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <h2 id={titleId} className="text-xl font-bold">
                {title}
              </h2>
              {description && (
                <div id={descriptionId} className="text-[0.95rem] text-pedra">
                  {description}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mt-1 -mr-1 grid size-10 shrink-0 place-items-center rounded-xl text-pedra hover:bg-nevoa hover:text-tinta"
              aria-label="Fechar"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
