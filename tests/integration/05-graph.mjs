// Graph runner — linear / conditional / cycles / async / validation.
// Pure-function steps; no LLM or agent runs here.

const sdk = await import("../../packages/sdk/dist/index.js");
const { Graph, START, END, collectFinalOutput } = sdk;

let failed = 0;
const check = (name, ok, info) => {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failed += 1;
    console.log(`  ✗ ${name}${info ? ` — ${info}` : ""}`);
  }
};

// ─── 1. Linear flow + state merging ──────────────────────────────────
console.log("[1] Linear flow + state merging");

const g1 = new Graph()
  .step("greet", (state) => ({ greeting: `hello ${state.name}` }))
  .step("shout", (state) => ({ greeting: state.greeting.toUpperCase() }))
  .edge("greet", "shout")
  .edge("shout", END);

const r1 = await g1.run({ name: "world" });
check(
  "path = greet → shout",
  JSON.stringify(r1.path) === JSON.stringify(["greet", "shout"]),
);
check("state merged through chain", r1.state.greeting === "HELLO WORLD");
check("original state preserved", r1.state.name === "world");

// ─── 2. Conditional branching ────────────────────────────────────────
console.log("\n[2] Conditional branching");

const g2 = new Graph()
  .step("classify", (state) => ({ category: state.input > 0 ? "pos" : "neg" }))
  .step("positive", () => ({ result: "pos-result" }))
  .step("negative", () => ({ result: "neg-result" }))
  .conditional("classify", (state) =>
    state.category === "pos" ? "positive" : "negative",
  )
  .edge("positive", END)
  .edge("negative", END);

const r2pos = await g2.run({ input: 5 });
const r2neg = await g2.run({ input: -3 });
check(
  "positive branch",
  r2pos.state.result === "pos-result" && r2pos.path.includes("positive"),
);
check(
  "negative branch",
  r2neg.state.result === "neg-result" && r2neg.path.includes("negative"),
);
check("positive path skips negative", !r2pos.path.includes("negative"));

// ─── 3. Cycles + maxSteps safety ──────────────────────────────────────
console.log("\n[3] Cycles + safety");

const g3 = new Graph()
  .step("incr", (state) => ({ count: (state.count ?? 0) + 1 }))
  .step("check", (state) => ({ done: state.count >= 3 }))
  .edge("incr", "check")
  .conditional("check", (state) => (state.done ? END : "incr"));

const r3 = await g3.run({ count: 0 });
check("loop terminated by condition", r3.state.count === 3);
check(
  "path includes 3 incr steps",
  r3.path.filter((p) => p === "incr").length === 3,
);

const g3bad = new Graph()
  .step("forever", () => ({}))
  .edge("forever", "forever");
let didFail = false;
try {
  await g3bad.run({}, { maxSteps: 5 });
} catch (e) {
  didFail = e.message.includes("maxSteps");
}
check("infinite loop hits maxSteps", didFail);

// ─── 4. Async steps ───────────────────────────────────────────────────
console.log("\n[4] Async step support");

const g4 = new Graph()
  .step("delay", async () => {
    await new Promise((r) => setTimeout(r, 30));
    return { delayed: true };
  })
  .step("done", (state) => ({ ok: state.delayed === true }))
  .edge("delay", "done")
  .edge("done", END);

const r4 = await g4.run({});
check("async step awaited correctly", r4.state.ok === true);

// ─── 5. Validation / errors ───────────────────────────────────────────
console.log("\n[5] Validation + errors");

let dupErr = "";
try {
  new Graph().step("a", () => ({})).step("a", () => ({}));
} catch (e) {
  dupErr = e.message;
}
check("duplicate step name rejected", dupErr.includes("already defined"));

let unknownErr = "";
try {
  new Graph().step("a", () => ({})).edge("a", "ghost");
} catch (e) {
  unknownErr = e.message;
}
check("edge to unknown target rejected", unknownErr.includes("unknown step"));

let danglingErr = "";
try {
  const g = new Graph().step("a", () => ({}));
  await g.run({});
} catch (e) {
  danglingErr = e.message;
}
check(
  "step with no outgoing edge errors at runtime",
  danglingErr.includes("no outgoing edge"),
);

// ─── 6. .describe() shape ─────────────────────────────────────────────
console.log("\n[6] describe()");

const g6 = new Graph()
  .step("a", () => ({}))
  .step("b", () => ({}))
  .step("c", () => ({}))
  .edge("a", "b")
  .conditional("b", () => "c")
  .edge("c", END)
  .start("a");

const d = g6.describe();
check("describe.entry", d.entry === "a");
check(
  "describe.steps",
  JSON.stringify(d.steps) === JSON.stringify(["a", "b", "c"]),
);
check(
  "describe.edges captures both kinds",
  d.edges.length === 3 &&
    d.edges.some((e) => e.kind === "conditional") &&
    d.edges.some((e) => e.kind === "static" && e.to === END),
);

// ─── 7. Exported surface ──────────────────────────────────────────────
console.log("\n[7] Exported API surface");

check("Graph class exported", typeof Graph === "function");
check("START sentinel exported", typeof START === "string");
check("END sentinel exported", typeof END === "string");
check("collectFinalOutput exported", typeof collectFinalOutput === "function");

console.log(failed === 0 ? "\nALL OK ✓" : `\n${failed} CHECK(S) FAILED ✗`);
process.exit(failed === 0 ? 0 : 1);
