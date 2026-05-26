/**
 * Master-key rotation script.
 *
 * Prereqs (set in env before invoking):
 *   RELAY_MASTER_KEY          ← the NEW key (will become primary)
 *   RELAY_MASTER_KEY_PREVIOUS ← the OLD key (so we can decrypt existing rows)
 *   DATABASE_URL              ← admin connection (owner role, bypasses RLS)
 *
 * What it does:
 *   1. Streams every row in `provider_credentials`.
 *   2. For each row, attempts to decrypt with the current primary. If that
 *      succeeds, leaves the row alone (already on the new key).
 *      If it fails, decrypts with the previous key and re-encrypts with
 *      the primary, writing back atomically.
 *   3. Writes one audit_events row per tenant whose credentials were
 *      re-encrypted, plus a summary line on stdout.
 *
 * Safe to run multiple times. Idempotent: a second run finds nothing to do.
 *
 * Usage:
 *   RELAY_MASTER_KEY=<new> RELAY_MASTER_KEY_PREVIOUS=<old> \
 *     pnpm --filter @relayhq/db rotate-master-key
 */

import { getAdminPool } from "./client.js";
import { reseal, type SealedSecret } from "./encryption.js";
import { recordAudit } from "./audit.js";

async function main() {
  if (!process.env.RELAY_MASTER_KEY) {
    throw new Error(
      "RELAY_MASTER_KEY (the new key) must be set before running rotation.",
    );
  }
  if (!process.env.RELAY_MASTER_KEY_PREVIOUS) {
    console.warn(
      "[rotate-master-key] RELAY_MASTER_KEY_PREVIOUS is not set. " +
        "If any rows were encrypted with a different key, this script " +
        "will refuse to lose them and abort that row.",
    );
  }

  const pool = getAdminPool();

  const res = await pool.query<{
    tenant_id: string;
    provider: string;
    ciphertext: Buffer;
    iv: Buffer;
    auth_tag: Buffer;
  }>(
    `select tenant_id, provider, ciphertext, iv, auth_tag
       from provider_credentials`,
  );

  console.log(`[rotate-master-key] scanning ${res.rows.length} credential rows`);

  let rotated = 0;
  let skipped = 0;
  let failed = 0;
  const tenantsRotated = new Set<string>();

  for (const row of res.rows) {
    const sealed: SealedSecret = {
      ciphertext: row.ciphertext,
      iv: row.iv,
      authTag: row.auth_tag,
    };
    try {
      const next = reseal(sealed);
      if (!next) {
        skipped += 1;
        continue;
      }
      await pool.query(
        `update provider_credentials
            set ciphertext = $3, iv = $4, auth_tag = $5, updated_at = now()
          where tenant_id = $1 and provider = $2`,
        [row.tenant_id, row.provider, next.ciphertext, next.iv, next.authTag],
      );
      rotated += 1;
      tenantsRotated.add(row.tenant_id);
      console.log(
        `  ✓ rotated tenant=${row.tenant_id} provider=${row.provider}`,
      );
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `  ✗ tenant=${row.tenant_id} provider=${row.provider}: ${message}`,
      );
    }
  }

  // One audit event per tenant whose credentials moved.
  for (const tenantId of tenantsRotated) {
    await recordAudit({
      tenantId,
      actor: { kind: "admin" },
      action: "master_key.rotated",
      targetType: "provider_credentials",
      metadata: { rowsRotated: rotated },
    });
  }

  console.log(
    `\n[rotate-master-key] done. rotated=${rotated} skipped=${skipped} failed=${failed} tenants=${tenantsRotated.size}`,
  );
  if (failed > 0) {
    process.exit(1);
  }
  await pool.end();
}

main().catch((err) => {
  console.error("[rotate-master-key] fatal:", err);
  process.exit(1);
});
