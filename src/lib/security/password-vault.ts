import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const CIPHER_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_VERSION = 1;
const HASH_VERSION = "scrypt-v1";
const KEY_BYTES = 32;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const HASH_BYTES = 64;

export type EncryptedPassword = {
  version: typeof ENCRYPTION_VERSION;
  algorithm: "aes-256-gcm";
  iv: string;
  authenticationTag: string;
  ciphertext: string;
};

export function isEncryptedPassword(value: unknown): value is EncryptedPassword {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === ENCRYPTION_VERSION &&
    candidate.algorithm === CIPHER_ALGORITHM &&
    typeof candidate.iv === "string" &&
    typeof candidate.authenticationTag === "string" &&
    typeof candidate.ciphertext === "string"
  );
}

function encode(value: Buffer) {
  return value.toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url");
}

function getEncryptionKey() {
  const configuredKey = process.env.PASSWORD_VAULT_ENCRYPTION_KEY;
  if (!configuredKey) {
    throw new Error("PASSWORD_VAULT_ENCRYPTION_KEY não está configurada no servidor.");
  }

  const key = Buffer.from(configuredKey, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error("PASSWORD_VAULT_ENCRYPTION_KEY deve ser uma chave Base64 de 32 bytes.");
  }

  return key;
}

export function hashPassword(password: string) {
  const salt = randomBytes(SALT_BYTES);
  const derivedKey = scryptSync(password, salt, HASH_BYTES);
  return `${HASH_VERSION}$${encode(salt)}$${encode(derivedKey)}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [version, encodedSalt, encodedHash, ...extraParts] = storedHash.split("$");
  if (version !== HASH_VERSION || !encodedSalt || !encodedHash || extraParts.length > 0) {
    return false;
  }

  try {
    const salt = decode(encodedSalt);
    const expectedHash = decode(encodedHash);
    if (salt.length !== SALT_BYTES || expectedHash.length !== HASH_BYTES) {
      return false;
    }

    const actualHash = scryptSync(password, salt, expectedHash.length);
    return timingSafeEqual(actualHash, expectedHash);
  } catch {
    return false;
  }
}

export function encryptPassword(password: string): EncryptedPassword {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(CIPHER_ALGORITHM, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);

  return {
    version: ENCRYPTION_VERSION,
    algorithm: CIPHER_ALGORITHM,
    iv: encode(iv),
    authenticationTag: encode(cipher.getAuthTag()),
    ciphertext: encode(ciphertext),
  };
}

export function decryptPassword(payload: EncryptedPassword) {
  if (payload.version !== ENCRYPTION_VERSION || payload.algorithm !== CIPHER_ALGORITHM) {
    throw new Error("Formato de senha criptografada não suportado.");
  }

  const iv = decode(payload.iv);
  if (iv.length !== IV_BYTES) {
    throw new Error("Senha criptografada inválida.");
  }

  try {
    const decipher = createDecipheriv(CIPHER_ALGORITHM, getEncryptionKey(), iv);
    decipher.setAuthTag(decode(payload.authenticationTag));
    const plaintext = Buffer.concat([
      decipher.update(decode(payload.ciphertext)),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch {
    throw new Error("Não foi possível descriptografar a senha.");
  }
}

