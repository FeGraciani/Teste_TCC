import "server-only";
import { inArray, eq } from "drizzle-orm";
import { db } from "@/shared/infrastructure/database/client";
import { patientProfiles, users } from "@/shared/infrastructure/database/schema";
import { trySendEmail, type EmailMessage } from "@/shared/infrastructure/email/mailer";
import { renderEmail } from "@/shared/infrastructure/email/template";
import { appUrl } from "@/shared/infrastructure/env";
import { capitalize, formatTime, formatWeekdayLong } from "@/shared/lib/datetime";
import type { Role } from "@/modules/identity/domain/roles";

/** Cancelamento já gravado, à espera do aviso por e-mail. */
export type CancellationNotice = { appointmentId: string; patientId: string; startsAt: Date; cancelledBy: Role };

/**
 * Por discrição, o e-mail não diz com quem era a consulta, nem a especialidade,
 * nem o motivo: só que a consulta daquele dia e horário foi cancelada. O
 * recado completo do profissional está no chat do app.
 */
export function appointmentCancelledEmail(params: { to: string; firstName: string; startsAt: Date }): EmailMessage {
  const when = `${formatWeekdayLong(params.startsAt)}, às ${formatTime(params.startsAt)}`;
  return {
    to: params.to,
    subject: "Sua consulta foi cancelada",
    ...renderEmail({
      preview: `${capitalize(when)}: consulta cancelada. Veja o recado no app.`,
      title: "Sua consulta foi cancelada",
      greeting: `Olá, ${params.firstName}.`,
      paragraphs: [
        `A consulta de ${when} (horário de Brasília) foi cancelada. Não é preciso fazer nada sobre ela, e nenhum valor será cobrado.`,
        "O recado do profissional está nas suas mensagens no app, onde você também pode escolher um novo horário.",
      ],
      action: { label: "Ver mensagem e reagendar", url: `${appUrl()}/paciente/mensagens` },
    }),
  };
}

/**
 * Envia o aviso por e-mail das consultas canceladas pelo profissional ou pela
 * clínica (o paciente que cancela já sabe). Chamar DEPOIS do commit.
 */
export async function emailCancellationNotices(notices: readonly CancellationNotice[]): Promise<void> {
  const relevant = notices.filter((notice) => notice.cancelledBy !== "PATIENT");
  if (relevant.length === 0) return;

  const people = await db
    .select({ patientId: patientProfiles.id, email: users.email, name: users.name, preferredName: patientProfiles.preferredName })
    .from(patientProfiles)
    .innerJoin(users, eq(users.id, patientProfiles.userId))
    .where(inArray(patientProfiles.id, [...new Set(relevant.map((notice) => notice.patientId))]));

  await Promise.all(
    relevant.map((notice) => {
      const person = people.find((item) => item.patientId === notice.patientId);
      if (!person) return null;
      const firstName = (person.preferredName?.trim() || person.name).split(/\s+/)[0] ?? person.name;
      return trySendEmail(appointmentCancelledEmail({ to: person.email, firstName, startsAt: notice.startsAt }));
    }),
  );
}
