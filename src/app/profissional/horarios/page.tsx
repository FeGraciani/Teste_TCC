import type { Metadata } from "next";
import { CLINIC_TIME_ZONE } from "@/config/clinic";
import { requireRole } from "@/modules/identity/application/current-actor";
import { getScheduleConfiguration } from "@/modules/scheduling/application/schedule-service";
import { todayKey } from "@/modules/scheduling/domain/availability";
import { ScheduleSettingsForm } from "@/modules/scheduling/presentation/components/schedule-settings-form";
import { TimeOffForm, TimeOffItem } from "@/modules/scheduling/presentation/components/time-off";
import { WeeklyScheduleEditor } from "@/modules/scheduling/presentation/components/weekly-schedule-editor";
import { PageHeader, Panel } from "@/shared/ui/layout";

export const metadata: Metadata = { title: "Horários de trabalho" };

export default async function WorkingHoursPage() {
  const actor = await requireRole("PROFESSIONAL");
  const configuration = await getScheduleConfiguration(actor);

  return (
    <>
      <PageHeader
        title="Horários de trabalho"
        description="Defina quando você atende e quando faz trabalho interno. Os pacientes só veem os horários livres dos períodos de atendimento."
      />

      <div className="space-y-8">
        <Panel
          title="Grade semanal"
          description="“Atendimento” abre horários para agendamento. “Trabalho interno” ocupa seu tempo (supervisão, estudos, relatórios) sem aparecer para os pacientes."
        >
          <WeeklyScheduleEditor initialBlocks={configuration.blocks} />
        </Panel>

        <Panel title="Regras da agenda" description="Valem para os próximos agendamentos.">
          <ScheduleSettingsForm
            rules={configuration.rules}
            acceptsOnline={configuration.acceptsOnline}
            acceptsInPerson={configuration.acceptsInPerson}
          />
        </Panel>

        <section id="ausencias" className="scroll-mt-24">
          <Panel
            title="Ausências e imprevistos"
            description="Férias, congressos ou um imprevisto de última hora: o período sai da agenda e, se você quiser, os pacientes afetados são avisados pelo chat na hora."
          >
            <div className="space-y-8">
              <TimeOffForm today={todayKey(CLINIC_TIME_ZONE)} />
              <div>
                <h3 className="mb-1 font-bold">Próximas ausências</h3>
                {configuration.upcomingTimeOffs.length > 0 ? (
                  <ul className="divide-y divide-linha">
                    {configuration.upcomingTimeOffs.map((timeOff) => (
                      <TimeOffItem
                        key={timeOff.id}
                        timeOff={{ ...timeOff, startsAt: timeOff.startsAt.toISOString(), endsAt: timeOff.endsAt.toISOString() }}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-pedra">Nenhuma ausência registrada.</p>
                )}
              </div>
            </div>
          </Panel>
        </section>
      </div>
    </>
  );
}
