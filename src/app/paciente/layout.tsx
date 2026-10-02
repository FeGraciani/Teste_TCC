import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AREA_LABELS, NAVIGATION } from "@/config/navigation";
import { requireRole } from "@/modules/identity/application/current-actor";
import { AppShell } from "@/shared/ui/app-shell";
import { AccountBlock, monogramFromName } from "../_components/account-block";
import { loadNavCounters } from "../_lib/nav-counters";

export const metadata: Metadata = {
  title: { default: "Área do paciente", template: "%s | Área do paciente" },
  robots: { index: false, follow: false },
};

export default async function PatientLayout({ children }: { children: ReactNode }) {
  const actor = await requireRole("PATIENT");
  return (
    <AppShell
      homeHref="/paciente"
      areaLabel={AREA_LABELS.PATIENT}
      items={NAVIGATION.PATIENT}
      counters={await loadNavCounters(actor)}
      account={<AccountBlock name={actor.name} subtitle={actor.email} monogram={monogramFromName(actor.name)} tone="yellow" />}
    >
      {children}
    </AppShell>
  );
}
