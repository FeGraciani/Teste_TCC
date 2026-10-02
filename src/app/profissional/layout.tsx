import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AREA_LABELS, NAVIGATION } from "@/config/navigation";
import { SPECIALTY_LABELS } from "@/modules/clinical-records/domain/record-access";
import { requireRole } from "@/modules/identity/application/current-actor";
import { AppShell } from "@/shared/ui/app-shell";
import { AccountBlock, monogramFromName } from "../_components/account-block";
import { loadNavCounters } from "../_lib/nav-counters";

export const metadata: Metadata = {
  title: { default: "Área do profissional", template: "%s | Área do profissional" },
  robots: { index: false, follow: false },
};

export default async function ProfessionalLayout({ children }: { children: ReactNode }) {
  const actor = await requireRole("PROFESSIONAL");
  return (
    <AppShell
      homeHref="/profissional"
      areaLabel={AREA_LABELS.PROFESSIONAL}
      items={NAVIGATION.PROFESSIONAL}
      counters={await loadNavCounters(actor)}
      account={
        <AccountBlock
          name={actor.displayName}
          subtitle={SPECIALTY_LABELS[actor.specialty]}
          monogram={monogramFromName(actor.displayName)}
          tone={actor.specialty === "PSYCHIATRY" ? "green" : "violet"}
        />
      }
    >
      {children}
    </AppShell>
  );
}
