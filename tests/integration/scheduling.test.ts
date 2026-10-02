import { beforeEach, describe, expect, it } from "vitest";
import { setUserActive } from "@/modules/administration/application/administration-service";
import { listConversations, openConversation, sendMessage } from "@/modules/messaging/application/chat-service";
import { listPatientAppointments } from "@/modules/scheduling/application/agenda-service";
import { getAvailabilityForBooking } from "@/modules/scheduling/application/availability-service";
import { bookAppointment, cancelAppointment } from "@/modules/scheduling/application/booking-service";
import { addTimeOff } from "@/modules/scheduling/application/schedule-service";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/shared/errors";
import { clearOutbox, readOutbox } from "@/shared/infrastructure/email/mailer";
import { NOW, TUESDAY_ONLY, createAdmin, createPatient, createProfessional, createService, firstFreeSlot, resetDatabase } from "../support/factories";

const TUESDAY = "2030-03-05";
const cancellationEmails = () => readOutbox().filter((email) => email.subject === "Sua consulta foi cancelada");
const at = (time: string) => new Date(`${TUESDAY}T${time}:00-03:00`).toISOString();

describe("agenda e agendamento (com banco de dados real)", () => {
  beforeEach(async () => {
    await resetDatabase();
    clearOutbox();
  });

  it("oferece só os horários de atendimento livres e recusa horários fora da agenda", async () => {
    const service = await createService({ specialty: "PSYCHOLOGY", durationMinutes: 50 });
    const professional = await createProfessional({ specialty: "PSYCHOLOGY", blocks: TUESDAY_ONLY, slotStepMinutes: 60 });
    const patient = await createPatient();

    const availability = await getAvailabilityForBooking({ professionalId: professional.professionalId, serviceId: service.id }, NOW);
    const tuesday = availability.days.find((day) => day.dateKey === TUESDAY)!;
    expect(tuesday.slots.map((slot) => slot.time)).toEqual(["10:00", "11:00"]); // 13h é trabalho interno: nunca aparece

    for (const invalid of [at("13:00"), at("10:30"), at("09:00")]) {
      await expect(
        bookAppointment(patient, { professionalId: professional.professionalId, serviceId: service.id, startsAt: invalid, modality: "ONLINE" }, NOW),
      ).rejects.toBeInstanceOf(ConflictError);
    }

    await bookAppointment(
      patient,
      { professionalId: professional.professionalId, serviceId: service.id, startsAt: at("10:00"), modality: "ONLINE" },
      NOW,
    );
    const after = await getAvailabilityForBooking({ professionalId: professional.professionalId, serviceId: service.id }, NOW);
    expect(after.days.find((day) => day.dateKey === TUESDAY)!.slots.map((slot) => slot.time)).toEqual(["11:00"]);
  });

  it("dois pacientes disputando o mesmo horário ao mesmo tempo: só um consegue", async () => {
    const service = await createService({ specialty: "PSYCHOLOGY" });
    const professional = await createProfessional({ specialty: "PSYCHOLOGY", blocks: TUESDAY_ONLY, slotStepMinutes: 60 });
    const first = await createPatient();
    const second = await createPatient();
    const input = { professionalId: professional.professionalId, serviceId: service.id, startsAt: at("10:00"), modality: "ONLINE" };

    const results = await Promise.allSettled([bookAppointment(first, input, NOW), bookAppointment(second, input, NOW)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ConflictError);
  });

  it("o paciente não consegue duas consultas no mesmo horário, nem com profissionais diferentes", async () => {
    const service = await createService({ specialty: "PSYCHOLOGY" });
    const one = await createProfessional({ specialty: "PSYCHOLOGY", blocks: TUESDAY_ONLY, slotStepMinutes: 60 });
    const other = await createProfessional({ specialty: "PSYCHOLOGY", blocks: TUESDAY_ONLY, slotStepMinutes: 60 });
    const patient = await createPatient();
    await bookAppointment(patient, { professionalId: one.professionalId, serviceId: service.id, startsAt: at("10:00"), modality: "ONLINE" }, NOW);
    await expect(
      bookAppointment(patient, { professionalId: other.professionalId, serviceId: service.id, startsAt: at("10:00"), modality: "ONLINE" }, NOW),
    ).rejects.toThrow(/outra consulta nesse horário/);
  });

  it("cancelamento pelo profissional exige motivo, avisa o paciente pelo chat e libera o horário", async () => {
    const service = await createService({ specialty: "PSYCHIATRY", durationMinutes: 30 });
    const professional = await createProfessional({ specialty: "PSYCHIATRY", displayName: "Dra. Imprevisto" });
    const patient = await createPatient();
    const startsAt = await firstFreeSlot(professional.professionalId, service.id);
    const { appointmentId } = await bookAppointment(
      patient,
      { professionalId: professional.professionalId, serviceId: service.id, startsAt, modality: "ONLINE" },
      NOW,
    );

    await expect(cancelAppointment(professional, { appointmentId }, NOW)).rejects.toBeInstanceOf(ValidationError);
    await cancelAppointment(professional, { appointmentId, reason: "Tive um imprevisto de saúde." }, NOW);

    const { upcoming, past } = await listPatientAppointments(patient, NOW);
    expect(upcoming).toHaveLength(0);
    expect(past[0]).toMatchObject({ status: "CANCELLED", cancelledBy: "PROFESSIONAL", cancellationReason: "Tive um imprevisto de saúde." });

    const [conversation] = await listConversations(patient);
    const thread = await openConversation(patient, conversation!.id);
    expect(thread.messages.at(-1)).toMatchObject({ kind: "SYSTEM" });
    expect(thread.messages.at(-1)!.body).toContain("Dra. Imprevisto cancelou a consulta");
    expect(thread.messages.at(-1)!.body).toContain("Tive um imprevisto de saúde.");

    const availability = await getAvailabilityForBooking({ professionalId: professional.professionalId, serviceId: service.id }, NOW);
    expect(availability.days.some((day) => day.slots.some((slot) => slot.startsAt === startsAt))).toBe(true);

    // O paciente também recebe um e-mail discreto: sem o nome do profissional e sem o motivo (que ficam no app).
    const emails = cancellationEmails();
    expect(emails.map((email) => email.to)).toEqual([patient.email]);
    for (const secret of ["Imprevisto", "imprevisto de saúde", "Dra."]) {
      expect(emails[0]!.text).not.toContain(secret);
      expect(emails[0]!.html).not.toContain(secret);
    }
  });

  it("paciente cancela sozinho só até 24h antes; a administração pode cancelar com motivo", async () => {
    const service = await createService({ specialty: "PSYCHOLOGY" });
    const professional = await createProfessional({ specialty: "PSYCHOLOGY", blocks: TUESDAY_ONLY, slotStepMinutes: 60 });
    const patient = await createPatient();
    const { appointmentId } = await bookAppointment(
      patient,
      { professionalId: professional.professionalId, serviceId: service.id, startsAt: at("10:00"), modality: "ONLINE" },
      NOW,
    );

    const lateNight = new Date("2030-03-04T22:00:00-03:00"); // 12h antes
    await expect(cancelAppointment(patient, { appointmentId }, lateNight)).rejects.toBeInstanceOf(ForbiddenError);

    const admin = await createAdmin();
    await cancelAppointment(admin, { appointmentId, reason: "Consultório interditado para manutenção." }, lateNight);
    const { past } = await listPatientAppointments(patient, lateNight);
    expect(past[0]).toMatchObject({ status: "CANCELLED", cancelledBy: "ADMIN" });
  });

  it("ausência por imprevisto cancela as consultas do período e avisa cada paciente", async () => {
    const service = await createService({ specialty: "PSYCHOLOGY" });
    const professional = await createProfessional({ specialty: "PSYCHOLOGY", blocks: TUESDAY_ONLY, slotStepMinutes: 60 });
    const first = await createPatient();
    const second = await createPatient();
    for (const [patient, time] of [
      [first, "10:00"],
      [second, "11:00"],
    ] as const) {
      await bookAppointment(
        patient,
        { professionalId: professional.professionalId, serviceId: service.id, startsAt: at(time), modality: "ONLINE" },
        NOW,
      );
    }

    const result = await addTimeOff(
      professional,
      { startDate: TUESDAY, startTime: "00:00", endDate: TUESDAY, endTime: "23:59", reason: "imprevisto familiar", cancelConflicts: "on" },
      NOW,
    );
    expect(result).toEqual({ conflicts: 2, cancelled: 2 });

    for (const patient of [first, second]) {
      const [conversation] = await listConversations(patient);
      const thread = await openConversation(patient, conversation!.id);
      expect(thread.messages.at(-1)!.body).toContain("imprevisto familiar");
    }
    const availability = await getAvailabilityForBooking({ professionalId: professional.professionalId, serviceId: service.id }, NOW);
    expect(availability.days.find((day) => day.dateKey === TUESDAY)).toBeUndefined();
    expect(
      cancellationEmails()
        .map((email) => email.to)
        .sort(),
    ).toEqual([first.email, second.email].sort());
  });

  it("quem cancela é o paciente: não recebe e-mail (ele já sabe)", async () => {
    const service = await createService({ specialty: "PSYCHOLOGY" });
    const professional = await createProfessional({ specialty: "PSYCHOLOGY", blocks: TUESDAY_ONLY, slotStepMinutes: 60 });
    const patient = await createPatient();
    const { appointmentId } = await bookAppointment(
      patient,
      { professionalId: professional.professionalId, serviceId: service.id, startsAt: at("10:00"), modality: "ONLINE" },
      NOW,
    );
    await cancelAppointment(patient, { appointmentId }, NOW);
    expect(cancellationEmails()).toHaveLength(0);
  });

  it("desativar um profissional cancela as consultas futuras, avisa os pacientes e tira ele da agenda", async () => {
    const service = await createService({ specialty: "PSYCHOLOGY" });
    const professional = await createProfessional({ specialty: "PSYCHOLOGY", blocks: TUESDAY_ONLY, slotStepMinutes: 60 });
    const first = await createPatient();
    const second = await createPatient();
    await bookAppointment(
      first,
      { professionalId: professional.professionalId, serviceId: service.id, startsAt: at("10:00"), modality: "ONLINE" },
      NOW,
    );
    await bookAppointment(
      second,
      { professionalId: professional.professionalId, serviceId: service.id, startsAt: at("11:00"), modality: "ONLINE" },
      NOW,
    );

    const result = await setUserActive(await createAdmin(), professional.userId, false, NOW);
    expect(result).toEqual({ cancelledAppointments: 2 });

    for (const patient of [first, second]) {
      expect((await listPatientAppointments(patient, NOW)).upcoming).toHaveLength(0);
      const [conversation] = await listConversations(patient);
      const thread = await openConversation(patient, conversation!.id);
      expect(thread.messages.at(-1)!.body).toContain("A clínica cancelou a consulta");
      // A conversa com quem saiu da clínica fica só para leitura.
      expect(thread.counterpartActive).toBe(false);
      await expect(sendMessage(patient, { conversationId: conversation!.id, body: "Olá?" })).rejects.toBeInstanceOf(ValidationError);
    }
    expect(
      cancellationEmails()
        .map((email) => email.to)
        .sort(),
    ).toEqual([first.email, second.email].sort());
    await expect(
      bookAppointment(first, { professionalId: professional.professionalId, serviceId: service.id, startsAt: at("10:00"), modality: "ONLINE" }, NOW),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
