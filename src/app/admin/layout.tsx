import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AREA_LABELS, NAVIGATION } from "@/config/navigation";
import { requireRole } from "@/modules/identity/application/current-actor";
import { AppShell } from "@/shared/ui/app-shell";
import { AccountBlock, monogramFromName } from "../_components/account-block";

export const metadata: Metadata = {
  title: { default: "Administração", template: "%s | Administração" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const actor = await requireRole("ADMIN");
  return (
    <AppShell
      homeHref="/admin"
      areaLabel={AREA_LABELS.ADMIN}
      items={NAVIGATION.ADMIN}
      counters={{}}
      account={<AccountBlock name={actor.name} subtitle="Administração" monogram={monogramFromName(actor.name)} />}
    >
      {children}
    </AppShell>
  );
}
