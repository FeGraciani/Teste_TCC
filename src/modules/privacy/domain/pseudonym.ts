/**
 * Codinomes do modo anônimo: árvores e plantas brasileiras, com um número.
 * Ex.: "Jacarandá-27". Não carregam nenhuma informação sobre a pessoa.
 */
export const PSEUDONYM_WORDS = [
  "Ipê",
  "Jacarandá",
  "Quaresmeira",
  "Manacá",
  "Paineira",
  "Aroeira",
  "Pitanga",
  "Jabuticaba",
  "Cambuci",
  "Jequitibá",
  "Araucária",
  "Sapucaia",
  "Buriti",
  "Embaúba",
  "Guapuruvu",
  "Jatobá",
  "Angico",
  "Oiti",
  "Sibipiruna",
  "Ingá",
  "Caliandra",
  "Bromélia",
  "Carnaúba",
  "Pequi",
  "Umbu",
  "Mangaba",
  "Cambará",
  "Candeia",
  "Imbuia",
  "Peroba",
  "Guaritá",
  "Cajueiro",
  "Tarumã",
  "Cumaru",
  "Açaí",
  "Babaçu",
  "Juçara",
  "Copaíba",
  "Andiroba",
  "Macaúba",
] as const;

/**
 * @param attempt a cada colisão o serviço tenta de novo com números maiores.
 */
export function generatePseudonym(random: () => number = Math.random, attempt = 0): string {
  const word = PSEUDONYM_WORDS[Math.floor(random() * PSEUDONYM_WORDS.length)];
  const digits = attempt < 5 ? 2 : attempt < 10 ? 3 : 4;
  const min = 10 ** (digits - 1);
  const number = min + Math.floor(random() * (9 * min));
  return `${word}-${number}`;
}

const PSEUDONYM_PATTERN = new RegExp(`^(${PSEUDONYM_WORDS.join("|")})-\\d{2,4}$`);

export function isValidPseudonym(value: string): boolean {
  return PSEUDONYM_PATTERN.test(value);
}
