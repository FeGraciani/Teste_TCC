import { LogOut } from "lucide-react";
import { signOutAction } from "@/modules/identity/presentation/actions";
import { Avatar } from "@/shared/ui/avatar";

/** Nome, perfil e botão de sair, no rodapé do menu das áreas logadas. */
export function AccountBlock({
  name,
  subtitle,
  monogram,
  tone = "neutral",
}: {
  name: string;
  subtitle: string;
  monogram: string;
  tone?: "violet" | "green" | "neutral" | "yellow";
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 px-2">
        <Avatar monogram={monogram} tone={tone} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{name}</p>
          <p className="truncate text-sm text-pedra">{subtitle}</p>
        </div>
      </div>
      <form action={signOutAction}>
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[0.95rem] font-semibold text-tinta hover:bg-urucum-50 hover:text-urucum-700"
        >
          <LogOut className="size-[1.15rem] text-pedra" aria-hidden />
          Sair
        </button>
      </form>
    </div>
  );
}

export function monogramFromName(name: string): string {
  const parts = name
    .replace(/^(Dra?\.)\s+/i, "")
    .trim()
    .split(/\s+/);
  return ((parts[0]?.charAt(0) ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : "")).toUpperCase() || "?";
}
