-- ─────────────────────────────────────────────────────────────────────────
-- Regras de integridade garantidas pelo próprio banco (defesa em profundidade).
-- Mesmo que um bug na aplicação tente, o PostgreSQL recusa.
-- ─────────────────────────────────────────────────────────────────────────

-- 1) Nenhum profissional com duas consultas agendadas no mesmo horário,
--    e nenhum paciente em duas consultas ao mesmo tempo.
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_professional_no_overlap"
  EXCLUDE USING gist ("professional_id" WITH =, tstzrange("starts_at", "ends_at", '[)') WITH &&)
  WHERE ("status" = 'SCHEDULED');--> statement-breakpoint

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_patient_no_overlap"
  EXCLUDE USING gist ("patient_id" WITH =, tstzrange("starts_at", "ends_at", '[)') WITH &&)
  WHERE ("status" = 'SCHEDULED');--> statement-breakpoint

-- 2) Coerência de horários e valores.
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_valid_range" CHECK ("ends_at" > "starts_at");--> statement-breakpoint
ALTER TABLE "time_offs" ADD CONSTRAINT "time_offs_valid_range" CHECK ("ends_at" > "starts_at");--> statement-breakpoint
ALTER TABLE "weekly_schedule_blocks" ADD CONSTRAINT "weekly_schedule_blocks_valid" CHECK (
  "weekday" BETWEEN 1 AND 7 AND "start_minute" >= 0 AND "end_minute" <= 1440 AND "end_minute" > "start_minute"
);--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_valid_values" CHECK ("duration_minutes" > 0 AND "price_cents" >= 0);--> statement-breakpoint
ALTER TABLE "schedule_settings" ADD CONSTRAINT "schedule_settings_valid_values" CHECK (
  "buffer_minutes" BETWEEN 0 AND 120
  AND "slot_step_minutes" BETWEEN 5 AND 240
  AND "min_notice_hours" BETWEEN 0 AND 720
  AND "booking_window_days" BETWEEN 1 AND 365
);--> statement-breakpoint

-- 3) Prontuário imutável: não pode ser apagado nem ter o conteúdo alterado.
--    (O CFM exige guarda por no mínimo 20 anos — Resolução nº 1.821/2007.)
--    Única alteração permitida: desvincular a consulta (appointment_id → NULL).
CREATE OR REPLACE FUNCTION "clinical_records_immutable"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Registros de prontuário não podem ser apagados (registro %).', OLD."id";
  END IF;
  IF NEW."content_encrypted" IS DISTINCT FROM OLD."content_encrypted"
     OR NEW."patient_id" IS DISTINCT FROM OLD."patient_id"
     OR NEW."author_id" IS DISTINCT FROM OLD."author_id"
     OR NEW."type" IS DISTINCT FROM OLD."type"
     OR NEW."visibility" IS DISTINCT FROM OLD."visibility"
     OR NEW."created_at" IS DISTINCT FROM OLD."created_at" THEN
    RAISE EXCEPTION 'Registros de prontuário são imutáveis. Para corrigir, registre uma nova anotação (registro %).', OLD."id";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER "clinical_records_immutable"
  BEFORE UPDATE OR DELETE ON "clinical_records"
  FOR EACH ROW EXECUTE FUNCTION "clinical_records_immutable"();
