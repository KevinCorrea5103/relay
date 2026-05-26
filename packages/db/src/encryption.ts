import crypto from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

// ─── Key material ──────────────────────────────────────────────────────────
//
// RELAY_MASTER_KEY          → current key, used for ALL new encryptions.
// RELAY_MASTER_KEY_PREVIOUS → optional secondary key, only used to decrypt
//                             rows that were encrypted before a rotation.
//                             Once `pnpm db:rotate-master-key` finishes
//                             re-encrypting every row, this var can be
//                             unset.
//
// Rotation procedure:
//   1. Generate new key with `pnpm db:keygen`.
//   2. Set RELAY_MASTER_KEY_PREVIOUS to the current key.
//   3. Set RELAY_MASTER_KEY to the new key.
//   4. Restart the control plane.    ← new encryptions use the new key
//   5. Run `pnpm db:rotate-master-key`. ← rewrites old rows with new key
//   6. Unset RELAY_MASTER_KEY_PREVIOUS. Restart.

let primaryCached: Buffer | null = null;
let secondaryCached: Buffer | null | undefined; // undefined = unread; null = absent

function decodeKey(raw: string): Buffer {
  const buf =
    raw.length === KEY_BYTES * 2 && /^[0-9a-f]+$/i.test(raw)
      ? Buffer.from(raw, "hex")
      : Buffer.from(raw, "base64");
  if (buf.length !== KEY_BYTES) {
    throw new Error(
      `master key must decode to ${KEY_BYTES} bytes (got ${buf.length})`,
    );
  }
  return buf;
}

function primaryKey(): Buffer {
  if (primaryCached) return primaryCached;
  const raw = process.env.RELAY_MASTER_KEY;
  if (raw && raw.length > 0) {
    primaryCached = decodeKey(raw);
    return primaryCached;
  }
  console.warn(
    "[encryption] RELAY_MASTER_KEY not set — generating ephemeral key. " +
      "Credentials encrypted now will be unreadable after restart. " +
      "Set RELAY_MASTER_KEY in production.",
  );
  primaryCached = crypto.randomBytes(KEY_BYTES);
  return primaryCached;
}

function secondaryKey(): Buffer | null {
  if (secondaryCached !== undefined) return secondaryCached;
  const raw = process.env.RELAY_MASTER_KEY_PREVIOUS;
  if (!raw || raw.length === 0) {
    secondaryCached = null;
    return null;
  }
  secondaryCached = decodeKey(raw);
  return secondaryCached;
}

export type SealedSecret = {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
};

export function seal(plaintext: string): SealedSecret {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, primaryKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

// Decrypt with the primary key; on auth-tag failure, retry with the previous
// key if one is configured. This lets the system run uninterrupted during
// a rotation window — old rows still open, new rows go out with the new key.
export function open(sealed: SealedSecret): string {
  try {
    return openWith(sealed, primaryKey());
  } catch (err) {
    const sec = secondaryKey();
    if (sec) {
      return openWith(sealed, sec);
    }
    throw err;
  }
}

function openWith(sealed: SealedSecret, key: Buffer): string {
  const decipher = crypto.createDecipheriv(ALGO, key, sealed.iv);
  decipher.setAuthTag(sealed.authTag);
  return Buffer.concat([
    decipher.update(sealed.ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

// Forces re-encryption of an already-sealed blob using the current primary.
// Returns null when the blob is already sealed with the primary (no work).
// Used by the rotation script.
export function reseal(sealed: SealedSecret): SealedSecret | null {
  // We can't tell which key encrypted a blob without trying. Try primary;
  // if it works, no rewrite needed. If it fails, try secondary, then
  // re-seal with primary.
  try {
    openWith(sealed, primaryKey());
    return null;
  } catch {
    const sec = secondaryKey();
    if (!sec) {
      throw new Error(
        "blob cannot be decrypted with the current primary key and no " +
          "RELAY_MASTER_KEY_PREVIOUS is set — refusing to lose data",
      );
    }
    const plaintext = openWith(sealed, sec);
    return seal(plaintext);
  }
}

export function generateMasterKey(): string {
  return crypto.randomBytes(KEY_BYTES).toString("hex");
}

// Test seam only — lets the rotation script reset memoized keys after
// fiddling with process.env.
export function __resetKeyCacheForTests(): void {
  primaryCached = null;
  secondaryCached = undefined;
}
