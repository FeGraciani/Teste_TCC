import type { Metadata } from "next";
import { requireRole } from "@/modules/identity/application/current-actor";
import { MessagesScreen } from "@/modules/messaging/presentation/components/messages-screen";
import { PageHeader } from "@/shared/ui/layout";

export const metadata: Metadata = { title: "Mensagens" };

export default async function ProfessionalMessagesPage({ searchParams }: PageProps<"/profissional/mensagens">) {
  const actor = await requireRole("PROFESSIONAL");
  const params = await searchParams;
  const conversation = typeof params.c === "string" ? params.c : undefined;
  const counterpart = typeof params.com === "string" ? params.com : undefined;

  return (
    <>
      <PageHeader
        title="Mensagens"
        description="Converse com seus pacientes e avise sobre imprevistos. Cada paciente aparece com o nome que escolheu."
        className={conversation || counterpart ? "hidden lg:flex" : undefined}
      />
      <MessagesScreen actor={actor} basePath="/profissional/mensagens" conversationParam={conversation} counterpartParam={counterpart} />
    </>
  );
}
