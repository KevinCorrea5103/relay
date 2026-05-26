// RLS isolation + API key rotation + audit log + master-key rotation.

const db = await import("../../packages/db/dist/index.js");
const {
  getAdminPool,
  runAsTenant,
  runAsAdmin,
  createTenant,
  mintApiKey,
  revokeApiKey,
  listApiKeys,
  upsertCredential,
  recordAudit,
  listAuditEvents,
} = db;

let failed = 0;
const check = (name, ok, info) => {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failed += 1;
    console.log(`  ✗ ${name}${info ? ` — ${info}` : ""}`);
  }
};

const t1 = await createTenant("sec-t1-" + Date.now());
const t2 = await createTenant("sec-t2-" + Date.now());

try {
  // ─── RLS isolation ───────────────────────────────────────────────────
  console.log("[1] RLS isolation");

  await runAsAdmin(async () => {
    await upsertCredential({
      tenantId: t1.id,
      provider: "openai",
      apiKey: "key-t1",
      label: "t1",
    });
    await upsertCredential({
      tenantId: t2.id,
      provider: "openai",
      apiKey: "key-t2",
      label: "t2",
    });
  });

  const seenAsT1 = await runAsTenant(t1.id, async (client) => {
    const r = await client.query(
      "select tenant_id from provider_credentials",
    );
    return r.rows;
  });
  check(
    "t1 sees only its credential row",
    seenAsT1.length === 1 && seenAsT1[0].tenant_id === t1.id,
  );

  const tryCrossRead = await runAsTenant(t1.id, async (client) => {
    const r = await client.query(
      "select * from provider_credentials where tenant_id = $1",
      [t2.id],
    );
    return r.rows;
  });
  check("t1 cannot read t2 by explicit id", tryCrossRead.length === 0);

  let crossInsertBlocked = false;
  try {
    await runAsTenant(t1.id, async (client) => {
      await client.query(
        `insert into provider_credentials (tenant_id, provider, label, ciphertext, iv, auth_tag)
         values ($1, 'anthropic', 'evil', '\\x00', '\\x00', '\\x00')`,
        [t2.id],
      );
    });
  } catch {
    crossInsertBlocked = true;
  }
  check("t1 cannot insert a row attributed to t2", crossInsertBlocked);

  // ─── API key lifecycle + audit ───────────────────────────────────────
  console.log("\n[2] API key rotation + audit log");

  const k1 = await mintApiKey({ tenantId: t1.id, name: "initial" });
  const k2 = await mintApiKey({ tenantId: t1.id, name: "rotated" });
  await recordAudit({
    tenantId: t1.id,
    actor: { kind: "api_key", keyId: k1.descriptor.id },
    action: "api_key.created",
    targetType: "api_key",
    targetId: k2.descriptor.id,
  });
  const revoked = await revokeApiKey(t1.id, k1.descriptor.id);
  check("revokeApiKey returns true", revoked === true);
  await recordAudit({
    tenantId: t1.id,
    actor: { kind: "api_key", keyId: k2.descriptor.id },
    action: "api_key.revoked",
    targetType: "api_key",
    targetId: k1.descriptor.id,
  });

  const keys = await listApiKeys(t1.id);
  const k1Row = keys.find((k) => k.id === k1.descriptor.id);
  const k2Row = keys.find((k) => k.id === k2.descriptor.id);
  check("revoked key has revokedAt set", k1Row && k1Row.revokedAt != null);
  check("new key remains active", k2Row && k2Row.revokedAt == null);

  const events = await listAuditEvents({ tenantId: t1.id, limit: 50 });
  const createCount = events.filter((e) => e.action === "api_key.created").length;
  const revokeCount = events.filter((e) => e.action === "api_key.revoked").length;
  check("audit log contains api_key.created", createCount >= 1);
  check("audit log contains api_key.revoked", revokeCount === 1);

  const t2AuditSeen = await runAsTenant(t2.id, async (client) => {
    const r = await client.query(
      "select id from audit_events where tenant_id = $1",
      [t1.id],
    );
    return r.rows.length;
  });
  check("t2 cannot see t1's audit events", t2AuditSeen === 0);

  // ─── Master key envelope rotation ────────────────────────────────────
  console.log("\n[3] Master key envelope rotation");

  const oldKey = (await import("../../packages/db/dist/encryption.js"))
    .generateMasterKey();
  const newKey = (await import("../../packages/db/dist/encryption.js"))
    .generateMasterKey();

  process.env.RELAY_MASTER_KEY = oldKey;
  process.env.RELAY_MASTER_KEY_PREVIOUS = "";
  const encMod = await import("../../packages/db/dist/encryption.js?t1");
  encMod.__resetKeyCacheForTests();

  const sealedOld = encMod.seal("hello-world-secret");
  check("seal produces ciphertext", sealedOld.ciphertext.length > 0);
  check(
    "decrypt with current key",
    encMod.open(sealedOld) === "hello-world-secret",
  );

  process.env.RELAY_MASTER_KEY = newKey;
  process.env.RELAY_MASTER_KEY_PREVIOUS = oldKey;
  encMod.__resetKeyCacheForTests();

  check(
    "old ciphertext opens via previous key after rotation",
    encMod.open(sealedOld) === "hello-world-secret",
  );

  const resealed = encMod.reseal(sealedOld);
  check("reseal returns a new envelope", resealed !== null);

  process.env.RELAY_MASTER_KEY_PREVIOUS = "";
  encMod.__resetKeyCacheForTests();
  check(
    "resealed ciphertext opens with new primary alone",
    encMod.open(resealed) === "hello-world-secret",
  );

  let oldFailsAfterRotation = false;
  try {
    encMod.open(sealedOld);
  } catch {
    oldFailsAfterRotation = true;
  }
  check(
    "post-rotation, old envelope fails without previous key",
    oldFailsAfterRotation,
  );
} finally {
  const pool = getAdminPool();
  await pool.query("delete from runs where tenant_id in ($1, $2)", [t1.id, t2.id]);
  await pool.query("delete from tenants where id in ($1, $2)", [t1.id, t2.id]);
  await pool.end();
}

console.log(failed === 0 ? "\nALL OK ✓" : `\n${failed} CHECK(S) FAILED ✗`);
process.exit(failed === 0 ? 0 : 1);
