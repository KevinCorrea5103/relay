// RLS enforcement via the relay_app role + rate limiting (memory & Redis)
// + ClickHouse double-write round-trip.

const db = await import("../../packages/db/dist/index.js");
const {
  createTenant,
  getAdminPool,
  runAsTenant,
  runAsAdmin,
  upsertCredential,
} = db;

let failed = 0;
const check = (name, ok, info) => {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failed += 1;
    console.log(`  ✗ ${name}${info ? ` — ${info}` : ""}`);
  }
};

const t1 = await createTenant("scale-t1-" + Date.now());
const t2 = await createTenant("scale-t2-" + Date.now());

try {
  // ─── 1. RLS via relay_app (no superuser bypass) ────────────────────────
  console.log("[1] RLS via relay_app");

  await runAsAdmin(async () => {
    await upsertCredential({
      tenantId: t1.id,
      provider: "openai",
      apiKey: "k-t1",
    });
    await upsertCredential({
      tenantId: t2.id,
      provider: "openai",
      apiKey: "k-t2",
    });
  });

  const blind = await runAsTenant(
    "00000000-0000-0000-0000-000000000000",
    async (client) => {
      const r = await client.query(
        "select count(*)::int as n from provider_credentials",
      );
      return r.rows[0].n;
    },
  );
  check("relay_app sees 0 rows when scoped to a non-existent tenant", blind === 0);

  const onlyT1 = await runAsTenant(t1.id, async (client) => {
    const r = await client.query(
      "select count(*)::int as n from provider_credentials",
    );
    return r.rows[0].n;
  });
  check("relay_app sees exactly 1 row when scoped to t1", onlyT1 === 1);

  // ─── 2. Rate limit — memory backend ────────────────────────────────────
  console.log("\n[2] Rate limit — memory backend");

  delete process.env.REDIS_URL;
  const rlMem = await import(
    "../../packages/control-plane/dist/rate-limit.js?m=" + Date.now()
  );
  const initMem = await rlMem.initRateLimit();
  check("memory backend selected", initMem.kind === "memory");

  const tinyQuota = { capacity: 3, refillPerSec: 0.1 };
  const mem = new rlMem.__TESTING__.MemoryBackend();
  const decisions = await Promise.all([
    mem.take("k", tinyQuota, 1),
    mem.take("k", tinyQuota, 1),
    mem.take("k", tinyQuota, 1),
    mem.take("k", tinyQuota, 1),
  ]);
  check(
    "first 3 pass, 4th denied",
    decisions[0].allowed &&
      decisions[1].allowed &&
      decisions[2].allowed &&
      !decisions[3].allowed,
  );
  check("denial sets Retry-After > 0", decisions[3].retryAfterMs > 0);

  // ─── 3. Rate limit — Redis backend ─────────────────────────────────────
  console.log("\n[3] Rate limit — Redis backend");

  process.env.REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
  const rlR = await import(
    "../../packages/control-plane/dist/rate-limit.js?r=" + Date.now()
  );
  const initR = await rlR.initRateLimit();
  check("redis backend selected", initR.kind === "redis");

  const redisBackend = await rlR.__TESTING__.RedisBackend.connect(
    process.env.REDIS_URL,
  );
  const key = "rl-smoke-" + Date.now();
  const r1 = await redisBackend.take(key, tinyQuota, 1);
  const r2 = await redisBackend.take(key, tinyQuota, 1);
  const r3 = await redisBackend.take(key, tinyQuota, 1);
  const r4 = await redisBackend.take(key, tinyQuota, 1);
  check(
    "Redis: first 3 pass, 4th denied",
    r1.allowed && r2.allowed && r3.allowed && !r4.allowed,
  );
  check("Redis denial sets Retry-After > 0", r4.retryAfterMs > 0);
  await redisBackend.redis.quit().catch(() => {});

  // ─── 4. ClickHouse mirror round-trip ───────────────────────────────────
  console.log("\n[4] ClickHouse mirror");

  process.env.CLICKHOUSE_URL =
    process.env.CLICKHOUSE_URL || "http://relay:relay@localhost:8123/relay";
  const chMod = await import(
    "../../packages/control-plane/dist/clickhouse.js?c=" + Date.now()
  );
  const { clickhouse, mirrorEventToClickhouse } = chMod;
  check("clickhouse enabled when URL set", clickhouse.isEnabled() === true);

  const testRunId = "smoke-run-" + Date.now();
  for (let i = 0; i < 5; i++) {
    mirrorEventToClickhouse({
      tenantId: t1.id,
      runId: testRunId,
      seq: i,
      type: "token",
      payload: { type: "token", text: `chunk-${i}` },
    });
  }
  await clickhouse.flush();
  await new Promise((r) => setTimeout(r, 300));

  const rows = await clickhouse.query(
    `SELECT seq, event_type FROM run_events WHERE run_id = '${testRunId}' ORDER BY seq`,
  );
  check(
    "5 events round-tripped to ClickHouse",
    rows.length === 5,
    `got ${rows.length}`,
  );
  check('first event type is "token"', rows[0]?.event_type === "token");
} finally {
  const pool = getAdminPool();
  await pool.query("delete from runs where tenant_id in ($1, $2)", [t1.id, t2.id]);
  await pool.query("delete from tenants where id in ($1, $2)", [t1.id, t2.id]);
  await pool.end();
}

console.log(failed === 0 ? "\nALL OK ✓" : `\n${failed} CHECK(S) FAILED ✗`);
process.exit(failed === 0 ? 0 : 1);
