/**
 * Parâmetros operacionais da clínica.
 * Ficam em código (e não em variáveis de ambiente) porque precisam ser
 * idênticos no servidor e no navegador.
 */

/** Fuso horário oficial da clínica: toda a agenda é calculada nele. */
export const CLINIC_TIME_ZONE = "America/Sao_Paulo";

/** Idioma e região usados em datas, números e moeda. */
export const CLINIC_LOCALE = "pt-BR";

/** Antecedência mínima (em horas) para o próprio paciente cancelar uma consulta. */
export const PATIENT_CANCELLATION_MIN_HOURS = 24;

/** Quantos minutos antes do início a sala online fica disponível. */
export const ONLINE_ROOM_OPENS_MINUTES_BEFORE = 15;

/** Idade mínima para criar conta (menores exigem responsável legal). */
export const MINIMUM_PATIENT_AGE = 18;

/** Intervalo de atualização do chat, em milissegundos. */
export const CHAT_POLL_INTERVAL_MS = 4000;

/** Prefixo das salas de atendimento online (Jitsi Meet). */
export const ONLINE_MEETING_BASE_URL = "https://meet.jit.si";
