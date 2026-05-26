// NATS-backed custom-tools broker.
//
// Verifies the rendezvous that lets the runtime long-poll and the SDK
// POST a result hit each other via NATS KV — including across two
// separate broker instances, which is the whole point of the refactor.

import {
  initBroker,
  pendingTools,
  __TESTING__,
} from "../../packages/control-plane/dist/pending-tools.js";

const { NatsBroker } = __TESTING__;

let failed = 0;
const check = (name, ok, info) => {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failed += 1;
    console.log(`  ✗ ${name}${info ? ` — ${info}` : ""}`);
  }
};

const info = await initBroker();
console.log("broker kind:", info.kind);
if (info.kind !== "nats") {
  console.error("FAIL: expected NATS broker, got", info.kind);
  process.exit(1);
}

// ─── 1. wait-then-resolve (runtime polls first) ────────────────────────
{
  const runId = "run_" + Math.random().toString(36).slice(2, 10);
  const toolUseId = "tu_" + Math.random().toString(36).slice(2, 10);

  const waitP = pendingTools.wait(runId, toolUseId, 5_000);
  setTimeout(() => {
    pendingTools.resolve(runId, toolUseId, { ok: true, scenario: "wait-first" });
  }, 100);

  const result = await waitP;
  check(
    "wait-then-resolve round-trips the payload",
    JSON.stringify(result) === JSON.stringify({ ok: true, scenario: "wait-first" }),
  );
}

// ─── 2. resolve-then-wait (SDK posts before runtime polls) ─────────────
{
  const runId = "run_" + Math.random().toString(36).slice(2, 10);
  const toolUseId = "tu_" + Math.random().toString(36).slice(2, 10);

  await pendingTools.resolve(runId, toolUseId, {
    ok: true,
    scenario: "resolve-first",
  });
  await new Promise((r) => setTimeout(r, 50));
  const result = await pendingTools.wait(runId, toolUseId, 5_000);
  check(
    "resolve-then-wait reads the buffered value",
    JSON.stringify(result) === JSON.stringify({ ok: true, scenario: "resolve-first" }),
  );
}

// ─── 3. cross-instance (two broker instances, like two CP replicas) ────
{
  const brokerB = await NatsBroker.connect(process.env.NATS_URL);
  const runId = "run_" + Math.random().toString(36).slice(2, 10);
  const toolUseId = "tu_" + Math.random().toString(36).slice(2, 10);

  const waitP = pendingTools.wait(runId, toolUseId, 5_000);
  setTimeout(() => {
    brokerB.resolve(runId, toolUseId, { ok: true, scenario: "cross-instance" });
  }, 150);

  const result = await waitP;
  check(
    "instance A wait, instance B resolve — A unblocks",
    JSON.stringify(result) === JSON.stringify({ ok: true, scenario: "cross-instance" }),
  );
  await brokerB.close();
}

// ─── 4. timeout fires inside the configured window ─────────────────────
{
  const runId = "run_" + Math.random().toString(36).slice(2, 10);
  const toolUseId = "tu_" + Math.random().toString(36).slice(2, 10);
  const t0 = Date.now();
  try {
    await pendingTools.wait(runId, toolUseId, 500);
    check("timeout fires", false, "wait should have rejected");
  } catch (err) {
    const dt = Date.now() - t0;
    check(
      `timeout fires within window (got ${dt}ms)`,
      dt >= 450 && dt <= 1500,
    );
  }
}

console.log(failed === 0 ? "\nALL OK ✓" : `\n${failed} CHECK(S) FAILED ✗`);
process.exit(failed === 0 ? 0 : 1);
