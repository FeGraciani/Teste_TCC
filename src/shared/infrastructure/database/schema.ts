/**
 * Ponto único que reúne as tabelas de todos os módulos.
 * Cada módulo continua sendo o dono do seu schema; este arquivo apenas
 * os agrega para o cliente do Drizzle. (Imports relativos de propósito:
 * o drizzle-kit não resolve o alias "@/".)
 */
export * from "../../../modules/identity/infrastructure/schema";
export * from "../../../modules/catalog/infrastructure/schema";
export * from "../../../modules/privacy/infrastructure/schema";
export * from "../../../modules/scheduling/infrastructure/schema";
export * from "../../../modules/clinical-records/infrastructure/schema";
export * from "../../../modules/messaging/infrastructure/schema";
export * from "../../../modules/audit/infrastructure/schema";
