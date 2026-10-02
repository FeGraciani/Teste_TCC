-- ─────────────────────────────────────────────────────────────────────────
-- 1) Links de acesso de uso único (convite e redefinição de senha).
--    A administração não vê nem define senhas de ninguém.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TYPE "public"."account_token_purpose" AS ENUM('INVITE', 'PASSWORD_RESET');--> statement-breakpoint
CREATE TABLE "account_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" "account_token_purpose" NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"requested_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "account_tokens" ADD CONSTRAINT "account_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_tokens" ADD CONSTRAINT "account_tokens_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_tokens_user_idx" ON "account_tokens" USING btree ("user_id");--> statement-breakpoint

-- Quem ainda não aceitou o convite fica com password_set_at nulo.
-- Contas existentes já têm senha definida pela própria pessoa.
ALTER TABLE "users" ADD COLUMN "password_set_at" timestamp with time zone;--> statement-breakpoint
UPDATE "users" SET "password_set_at" = "created_at";--> statement-breakpoint

-- ─────────────────────────────────────────────────────────────────────────
-- 2) Liberações por campo (pedido de acesso aprovado pelo paciente).
--    Valem por cima da configuração vigente, até o paciente revogar.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE "privacy_field_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"professional_id" uuid NOT NULL,
	"field" text NOT NULL,
	"access_request_id" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "privacy_field_grants" ADD CONSTRAINT "privacy_field_grants_patient_id_patient_profiles_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_field_grants" ADD CONSTRAINT "privacy_field_grants_professional_id_professional_profiles_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professional_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_field_grants" ADD CONSTRAINT "privacy_field_grants_access_request_id_privacy_access_requests_id_fk" FOREIGN KEY ("access_request_id") REFERENCES "public"."privacy_access_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "privacy_field_grants_active_uq" ON "privacy_field_grants" USING btree ("patient_id","professional_id","field") WHERE "privacy_field_grants"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "privacy_field_grants_professional_idx" ON "privacy_field_grants" USING btree ("professional_id","patient_id");--> statement-breakpoint

-- Pedidos já aprovados antes desta versão viram liberações explícitas
-- (a exceção que eles criaram continua existindo e pode ser revisada pelo paciente).
INSERT INTO "privacy_field_grants" ("patient_id", "professional_id", "field", "access_request_id", "granted_at")
SELECT r."patient_id", r."professional_id", f."field", r."id", coalesce(r."responded_at", now())
FROM "privacy_access_requests" AS r
CROSS JOIN LATERAL jsonb_array_elements_text(r."fields") AS f("field")
WHERE r."status" = 'APPROVED'
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- ─────────────────────────────────────────────────────────────────────────
-- 3) Prontuário: a especialidade do autor fica gravada no próprio registro.
--    (O trigger antigo não protege esta coluna, então o preenchimento passa.)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE "clinical_records" ADD COLUMN "author_specialty" "specialty";--> statement-breakpoint
UPDATE "clinical_records" AS r
SET "author_specialty" = p."specialty"
FROM "professional_profiles" AS p
WHERE p."id" = r."author_id";--> statement-breakpoint
ALTER TABLE "clinical_records" ALTER COLUMN "author_specialty" SET NOT NULL;--> statement-breakpoint

-- Imutabilidade passa a cobrir também a especialidade do autor.
CREATE OR REPLACE FUNCTION "clinical_records_immutable"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Registros de prontuário não podem ser apagados (registro %).', OLD."id";
  END IF;
  IF NEW."content_encrypted" IS DISTINCT FROM OLD."content_encrypted"
     OR NEW."patient_id" IS DISTINCT FROM OLD."patient_id"
     OR NEW."author_id" IS DISTINCT FROM OLD."author_id"
     OR NEW."author_specialty" IS DISTINCT FROM OLD."author_specialty"
     OR NEW."type" IS DISTINCT FROM OLD."type"
     OR NEW."visibility" IS DISTINCT FROM OLD."visibility"
     OR NEW."created_at" IS DISTINCT FROM OLD."created_at" THEN
    RAISE EXCEPTION 'Registros de prontuário são imutáveis. Para corrigir, registre uma nova anotação (registro %).', OLD."id";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

-- ─────────────────────────────────────────────────────────────────────────
-- 4) TRUNCATE também é bloqueado (inclusive em cascata).
--    Só o reset dos dados de DEMONSTRAÇÃO e dos testes liga, dentro da própria
--    transação, a chave alento.permitir_reset_demo = 'sim'.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION "clinical_records_no_truncate"() RETURNS trigger AS $$
BEGIN
  IF coalesce(current_setting('alento.permitir_reset_demo', true), '') <> 'sim' THEN
    RAISE EXCEPTION 'O prontuário não pode ser esvaziado (TRUNCATE): registros clínicos devem ser guardados por no mínimo 20 anos.';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER "clinical_records_no_truncate"
  BEFORE TRUNCATE ON "clinical_records"
  FOR EACH STATEMENT EXECUTE FUNCTION "clinical_records_no_truncate"();
