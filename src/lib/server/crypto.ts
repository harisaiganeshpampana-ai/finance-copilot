// SERVER-ONLY. Encrypts secrets (e.g. Plaid access tokens) before they're stored in MongoDB,
// using AES-256-GCM (encrypted + tamper-proof).
//
// Key: ENCRYPTION_KEY (32 bytes, base64) if set; otherwise derived from NEXTAUTH_SECRET with
// HKDF. Note: if the key changes, previously stored secrets can't be decrypted (users would
// need to reconnect their bank).

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const VERSION = "v1";

export class EncryptionKeyMissingError extends Error {
  constructor() {
    super("No encryption key: set ENCRYPTION_KEY or NEXTAUTH_SECRET");
    this.name = "EncryptionKeyMissingError";
  }
}

export function encryptionKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const explicit = env.ENCRYPTION_KEY?.trim();
  if (explicit) {
    const key = Buffer.from(explicit, "base64");
    if (key.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes, base64-encoded");
    return key;
  }
  const secret = env.NEXTAUTH_SECRET?.trim();
  if (!secret) throw new EncryptionKeyMissingError();
  return Buffer.from(hkdfSync("sha256", secret, "calmowe", "calmowe:secret-encryption:v1", 32));
}

/** Returns "v1:<iv>:<tag>:<ciphertext>" (base64 parts). */
export function encryptSecret(plain: string, key: Buffer = encryptionKey()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptSecret(payload: string, key: Buffer = encryptionKey()): string {
  const [version, iv, tag, ciphertext] = payload.split(":");
  if (version !== VERSION || !iv || !tag || !ciphertext) throw new Error("Unrecognized encrypted value");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
}
