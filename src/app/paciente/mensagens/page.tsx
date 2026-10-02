import type { Metadata } from "next";
import { requireRole } from "@/modules/identity/application/current-actor";
import { MessagesScreen } from "@/modules/messaging/presentation/components/messages-screen";
import { PageHeader } from "@/shared/ui/layout";

export const metadata: Metadata = { title: "Mensagens" };

export default async function PatientMessagesPage({ searchParams }: PageProps<"/paciente/mensagens">) {
  const actor = await requireRole("PATIENT");
  const params = await searchParams;
  const conversation = typeof params.c === "string" ? params.c : undefined;
  const counterpart = typeof params.com === "string" ? params.com : undefined;

  return (
    <>
      <PageHeader
        title="Mensagens"
        description="Combine detalhes e avise sobre imprevistos com seu profissional. Cancelamentos e mudanças também aparecem aqui."
        className={conversation || counterpart ? "hidden lg:flex" : undefined}
      />
      <MessagesScreen actor={actor} basePath="/paciente/mensagens" conversationParam={conversation} counterpartParam={counterpart} />
    </>
  );
}
