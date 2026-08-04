import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

// Criptografia simétrica (AES-256-GCM) pra dados sensíveis guardados no
// BANCO — usado pela Fase 18 pro access_token do Meta Ads. É o 1º segredo
// de terceiro que este projeto passa a guardar no Postgres: todos os
// outros (Groq, Supabase, Asaas) ficam só em env var (nunca no banco), mas
// um access_token de OAuth é intrinsecamente um dado por-CLIENTE — não dá
// pra representar como env var, precisa estar na tabela `ad_accounts`. Sem
// criptografia, qualquer vazamento do banco (ou de uma service-role key)
// exporia esses tokens em texto puro.
//
// Chave derivada de `ENCRYPTION_KEY` (env var) via scrypt com um salt
// FIXO — aceitável aqui porque `ENCRYPTION_KEY` já é, por si só, um
// segredo de alta entropia gerado 1x (não uma senha de usuário fraca onde
// um salt único por registro seria essencial contra rainbow tables).
const ALGORITMO = "aes-256-gcm";
const SALT_FIXO = "kirozeth-ai-fase18-ad-accounts";
const TAMANHO_IV = 12; // recomendado pelo Node pra GCM

function obterChave(): Buffer {
  const segredo = process.env.ENCRYPTION_KEY;
  if (!segredo) {
    throw new Error(
      "ENCRYPTION_KEY não configurada — necessária pra guardar/ler tokens de integração (Fase 18). Gere uma string aleatória longa (32+ caracteres) e configure em .env.local."
    );
  }
  return scryptSync(segredo, SALT_FIXO, 32);
}

// Formato salvo: "<iv hex>:<authTag hex>:<ciphertext hex>" — os 3
// componentes precisam estar juntos pra decrypt() funcionar depois; não
// tem como recuperar o IV/tag separadamente se só o ciphertext for salvo.
export function encrypt(textoPlano: string): string {
  const chave = obterChave();
  const iv = randomBytes(TAMANHO_IV);
  const cipher = createCipheriv(ALGORITMO, chave, iv);
  const ciphertext = Buffer.concat([cipher.update(textoPlano, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decrypt(valorCriptografado: string): string {
  const partes = valorCriptografado.split(":");
  if (partes.length !== 3) {
    throw new Error("Valor criptografado em formato inesperado (esperava iv:authTag:ciphertext).");
  }
  const [ivHex, authTagHex, ciphertextHex] = partes;

  const chave = obterChave();
  const decipher = createDecipheriv(ALGORITMO, chave, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const textoPlano = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);
  return textoPlano.toString("utf8");
}
