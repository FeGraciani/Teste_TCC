import { randomBytes } from "node:crypto";

/**
 * Gera uma chave AES-256 para a variável ENCRYPTION_KEY.
 * Uso: npm run generate:key
 */
const key = randomBytes(32).toString("base64");

console.log("\nNova chave de criptografia (cole no seu .env):\n");
console.log(`ENCRYPTION_KEY="${key}"\n`);
console.log("Guarde esta chave em um cofre de segredos. Sem ela, prontuários e mensagens não podem ser lidos.\n");
