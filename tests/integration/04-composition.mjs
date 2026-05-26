// JSON-schema validation + run linking + workflow trees + cost aggregation
// + voice surface exports.

const db = await import("../../packages/db/dist/index.js");
const {
  createTenant,
  createRun,
  getRunTree,
  getWorkflowCost,
  completeRun,
  getAdminPool,
} = db;

const sdk = await import("../../packages/sdk/dist/index.js");
const { validateAgainstSchema } = sdk;

let failed = 0;
const check = (name, ok, info) => {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failed += 1;
    console.log(`  ✗ ${name}${info ? ` — ${info}` : ""}`);
  }
};

// ─── Schema validation ─────────────────────────────────────────────────
console.log("[1] JSON Schema validation");

const userSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    age: { type: "integer" },
    role: { type: "string", enum: ["admin", "user", "guest"] },
  },
  required: ["id"],
  additionalProperties: false,
};

check(
  "valid input passes",
  validateAgainstSchema({ id: "u_1", age: 30, role: "admin" }, userSchema) ===
    null,
);
check(
  "missing required field rejected",
  validateAgainstSchema({ age: 30 }, userSchema)?.includes("missing required") ??
    false,
);
check(
  "wrong type rejected",
  validateAgainstSchema({ id: 123 }, userSchema)?.includes("expected string") ??
    false,
);
check(
  "extra field rejected with additionalProperties=false",
  validateAgainstSchema({ id: "u_1", extra: "x" }, userSchema)?.includes(
    "unexpected",
  ) ?? false,
);
check(
  "enum violation rejected",
  validateAgainstSchema({ id: "u_1", role: "superadmin" }, userSchema)?.includes(
    "expected one of",
  ) ?? false,
);
check(
  "non-integer for integer rejected",
  validateAgainstSchema({ id: "u_1", age: 3.14 }, userSchema)?.includes(
    "integer",
  ) ?? false,
);
check(
  "nested array validation",
  validateAgainstSchema([1, 2, "bad"], {
    type: "array",
    items: { type: "number" },
  })?.includes("item 2") ?? false,
);

// ─── Run linking + tree + cost ─────────────────────────────────────────
console.log("\n[2] Run linking, workflow tree, cost aggregation");

const tenant = await createTenant("comp-" + Date.now());

try {
  const root = await createRun({
    tenantId: tenant.id,
    model: "gpt-4o-mini",
    input: "root prompt",
    tools: [],
  });
  check("root.workflowId == root.id", root.workflowId === root.id);

  const childA = await createRun({
    tenantId: tenant.id,
    model: "gpt-4o-mini",
    input: "child A",
    tools: [],
    parentRunId: root.id,
    workflowId: root.workflowId,
  });
  check("childA inherits root.workflowId", childA.workflowId === root.id);
  check("childA.parentRunId = root.id", childA.parentRunId === root.id);

  const grandchild = await createRun({
    tenantId: tenant.id,
    model: "gpt-4o-mini",
    input: "grandchild",
    tools: [],
    parentRunId: childA.id,
    workflowId: root.workflowId,
  });
  check("grandchild shares workflowId", grandchild.workflowId === root.id);

  const childB = await createRun({
    tenantId: tenant.id,
    model: "gpt-4o-mini",
    input: "child B",
    tools: [],
    parentRunId: root.id,
    workflowId: root.workflowId,
  });

  await completeRun({
    id: root.id,
    output: "ok",
    inputTokens: 10,
    outputTokens: 5,
  });
  await completeRun({
    id: childA.id,
    output: "ok",
    inputTokens: 20,
    outputTokens: 8,
  });
  await completeRun({
    id: grandchild.id,
    output: "ok",
    inputTokens: 7,
    outputTokens: 3,
  });
  await completeRun({
    id: childB.id,
    output: "ok",
    inputTokens: 4,
    outputTokens: 2,
  });

  const tree = await getRunTree({ tenantId: tenant.id, workflowId: root.id });
  check("tree returns all 4 runs", tree.length === 4, `got ${tree.length}`);
  check("tree[0] is root (depth 0)", tree[0].depth === 0 && tree[0].id === root.id);

  const depthMap = new Map(tree.map((r) => [r.id, r.depth]));
  check("childA depth = 1", depthMap.get(childA.id) === 1);
  check("grandchild depth = 2", depthMap.get(grandchild.id) === 2);
  check("childB depth = 1", depthMap.get(childB.id) === 1);

  const cost = await getWorkflowCost({ tenantId: tenant.id, workflowId: root.id });
  check("workflow cost: 4 runs", cost.runCount === 4);
  check("total input tokens = 41", cost.inputTokens === 41);
  check("total output tokens = 18", cost.outputTokens === 18);

  const otherRoot = await createRun({
    tenantId: tenant.id,
    model: "gpt-4o-mini",
    input: "unrelated",
    tools: [],
  });
  await completeRun({
    id: otherRoot.id,
    output: "x",
    inputTokens: 1000,
    outputTokens: 2000,
  });
  const cost2 = await getWorkflowCost({ tenantId: tenant.id, workflowId: root.id });
  check("unrelated workflow doesn't contaminate cost", cost2.inputTokens === 41);

  // ─── Voice surface ────────────────────────────────────────────────────
  console.log("\n[3] Voice — exported surface (no real OpenAI call)");

  const voice = await import("../../packages/control-plane/dist/voice.js");
  check("handleTranscribe exported", typeof voice.handleTranscribe === "function");
  check("handleSynthesize exported", typeof voice.handleSynthesize === "function");

  check("sdk.transcribe exported", typeof sdk.transcribe === "function");
  check("sdk.synthesize exported", typeof sdk.synthesize === "function");
  check("sdk.subagent exported", typeof sdk.subagent === "function");
  check("sdk.Graph exported", typeof sdk.Graph === "function");
  check("sdk.validateAgainstSchema exported", typeof sdk.validateAgainstSchema === "function");
} finally {
  const pool = getAdminPool();
  await pool.query("delete from runs where tenant_id = $1", [tenant.id]);
  await pool.query("delete from tenants where id = $1", [tenant.id]);
  await pool.end();
}

console.log(failed === 0 ? "\nALL OK ✓" : `\n${failed} CHECK(S) FAILED ✗`);
process.exit(failed === 0 ? 0 : 1);
