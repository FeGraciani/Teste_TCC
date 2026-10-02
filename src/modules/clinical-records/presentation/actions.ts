"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/modules/identity/application/current-actor";
import type { ActionState } from "@/shared/lib/action-state";
import { formDataToObject } from "@/shared/lib/validation";
import { runAction } from "@/shared/presentation/run-action";
import { addClinicalRecord } from "../application/records-service";

/** Nova anotação no prontuário (imutável depois de salva). */
export async function addClinicalRecordAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("PROFESSIONAL");
  return runAction(async () => {
    await addClinicalRecord(actor, formDataToObject(formData));
    refresh();
    return "Registro salvo no prontuário. Ele fica disponível para os próximos profissionais conforme a visibilidade escolhida.";
  }, formData);
}
