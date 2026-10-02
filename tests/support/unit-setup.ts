// Chave fixa apenas para testes (32 bytes em base64).
process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
