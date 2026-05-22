import crypto from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

let cached: Buffer | null = null;

function masterKey(): Buffer {
  if (cached) return cached;
  const raw = process.env.RELAY_MASTER_KEY;
  if (raw && raw.length > 0) {
    const buf =
      raw.length === KEY_BYTES * 2 && /^[0-9a-f]+$/i.test(raw)
        ? Buffer.from(raw, "hex")
        : Buffer.from(raw, "base64");
    if (buf.length !== KEY_BYTES) {
      throw new Error(
        `RELAY_MASTER_KEY must decode to ${KEY_BYTES} bytes (got ${buf.length})`,
      );
    }
    cached = buf;
    return buf;
  }
  console.warn(
    "[encryption] RELAY_MASTER_KEY not set — generating ephemeral key. " +
      "Credentials encrypted now will be unreadable after restart. " +
      "Set RELAY_MASTER_KEY in production.",
  );
  cached = crypto.randomBytes(KEY_BYTES);
  return cached;
}

export type SealedSecret = {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
};

export function seal(plaintext: string): SealedSecret {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, masterKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

export function open(sealed: SealedSecret): string {
  const decipher = crypto.createDecipheriv(ALGO, masterKey(), sealed.iv);
  decipher.setAuthTag(sealed.authTag);
  return Buffer.concat([
    decipher.update(sealed.ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

export function generateMasterKey(): string {
  return crypto.randomBytes(KEY_BYTES).toString("hex");
}
