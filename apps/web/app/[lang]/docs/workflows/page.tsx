import { Code } from "@/components/Code";
import { Callout, DocsPage, H2, H3, InlineCode, P } from "@/components/DocsPage";
import { Mermaid } from "@/components/Mermaid";

const SUBAGENT_DIAGRAM = `flowchart TD
    parent["parent run<br/>writer agent"]
    sub["sub-run<br/>researcher agent"]
    sub2["sub-run<br/>critic agent"]
    parent -- "tool_use(research)" --> sub
    parent -- "tool_use(critique)" --> sub2
    sub -. "result" .-> parent
    sub2 -. "result" .-> parent`;

const GRAPH_DIAGRAM = `flowchart LR
    start([start]) --> research
    research --> write
    write --> review
    review -->|approved| done([end])
    review -->|reject| research`;

export default async function WorkflowsDocs({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return (
    <DocsPage
      slug="workflows"
      lang={lang}
      title="Workflows"
      description="Compose multiple agents. Two primitives: subagent() for LLM-driven composition, Graph for declarative pipelines."
    >
      <section>
        <H2 id="why">Three primitives, on purpose</H2>
        <P>
          Relay gives you three layers to build multi-agent systems. Each
          one solves a different problem; pick the lowest-level that fits.
        </P>
        <ul className="list-disc space-y-2 pl-5 text-ink-300">
          <li>
            <strong>
              <InlineCode>subagent()</InlineCode>
            </strong>{" "}
            wraps an agent as a <em>tool</em> that another agent can call.
            The parent LLM decides when and how to delegate. Best when the
            flow is open-ended — "research this if you need to."
          </li>
          <li>
            <strong>
              <InlineCode>createOrchestrator()</InlineCode>
            </strong>{" "}
            higher-level wrapper for the &quot;supervisor + team&quot;
            pattern. You hand it a team of named agents and one LLM
            coordinates them — auto-generates the system prompt from the
            team description. 80% of multi-agent use cases in 3 lines.
          </li>
          <li>
            <strong>
              <InlineCode>Graph</InlineCode>
            </strong>{" "}
            wires steps with explicit edges and state passing. The
            developer decides the flow. Best when the steps are
            deterministic — "always research, then write, then review."
          </li>
        </ul>
        <P>
          All three produce the same artifact server-side: a tree of runs
          linked by <InlineCode>workflow_id</InlineCode>. The dashboard
          renders the tree and the cost endpoint sums tokens across the
          whole workflow.
        </P>
      </section>

      <section>
        <H2 id="subagent">subagent() — LLM-driven composition</H2>
        <Mermaid chart={SUBAGENT_DIAGRAM} caption="a writer agent calls a researcher and a critic as tools" />
        <P>
          Wrap any <InlineCode>Agent</InlineCode> with{" "}
          <InlineCode>subagent({"{name, description, agent}"})</InlineCode>{" "}
          and pass it into another agent&apos;s tools. The LLM sees it as a
          normal function tool; the SDK runs the sub-agent linked to the
          parent run automatically.
        </P>
        <Code
          lang="ts"
          code={`import { createAgent, subagent, builtin } from "@relayhq/sdk";

const researcher = createAgent({
  model: "gpt-4o",
  system: "You research topics and return key facts.",
  tools: [builtin.calculator],
});

const writer = createAgent({
  model: "claude-sonnet-4-6",
  system: "You write concise posts grounded in the research you commission.",
  tools: [
    subagent({
      name: "research",
      description: "Research a topic and return key facts.",
      agent: researcher,
    }),
  ],
});

for await (const ev of writer.run("Write a 200-word post about pgvector")) {
  if (ev.type === "token") process.stdout.write(ev.text);
}`}
        />
        <Callout kind="tip">
          The sub-agent&apos;s events are NOT yielded into the parent
          stream — only its final output is returned as the tool result.
          To watch progress live, query{" "}
          <InlineCode>GET /v1/workflows/:id</InlineCode> from the dashboard.
        </Callout>

        <H3 id="subagent-py">Python</H3>
        <Code
          lang="python"
          code={`from relayhq import create_agent, subagent, builtin

researcher = create_agent(model="gpt-4o", tools=[builtin.calculator])

writer = create_agent(
    model="claude-sonnet-4-6",
    tools=[
        subagent(
            name="research",
            description="Research a topic",
            agent=researcher,
        ),
    ],
)`}
        />

        <H3 id="subagent-safety">Safety rails</H3>
        <ul className="list-disc space-y-2 pl-5 text-ink-300">
          <li>
            Depth is capped at 5 by default (set{" "}
            <InlineCode>maxDepth</InlineCode> per subagent). Beyond that
            the handler returns an error to the parent LLM.
          </li>
          <li>
            Input is validated against the JSON schema before invocation —
            an LLM that hallucinates args gets a structured error back
            instead of crashing the handler.
          </li>
          <li>
            Each sub-run gets its own row in <InlineCode>runs</InlineCode>{" "}
            with <InlineCode>parent_run_id</InlineCode> set, so the cost
            and trace are attributable.
          </li>
        </ul>
      </section>

      <section>
        <H2 id="orchestrator">createOrchestrator() — supervisor + team</H2>
        <P>
          The fastest path to a multi-agent system. You declare a team of
          named specialists; one supervisor LLM decides which to call for
          each part of the user&apos;s request, calls them as tools, and
          synthesizes the final answer.
        </P>
        <P>
          Under the hood, this is{" "}
          <InlineCode>createAgent()</InlineCode> with each teammate wrapped
          in <InlineCode>subagent()</InlineCode>, plus an auto-generated
          system prompt built from the team descriptions. You can do the
          same by hand — but you&apos;ll write the same boilerplate every
          time.
        </P>
        <Code
          lang="ts"
          code={`import { createAgent, createOrchestrator } from "@relayhq/sdk";

const researcher = createAgent({ model: "gpt-4o" });
const writer     = createAgent({ model: "claude-sonnet-4-6" });
const reviewer   = createAgent({ model: "claude-haiku-4-5" });

const team = createOrchestrator({
  model: "claude-sonnet-4-6",  // the supervisor's brain
  agents: {
    research: {
      agent: researcher,
      description: "Researches topics and returns key facts.",
    },
    write: {
      agent: writer,
      description: "Writes drafts from research notes.",
    },
    review: {
      agent: reviewer,
      description: "Reviews drafts; returns 'approved' or feedback.",
    },
  },
});

// Use it like any other agent
for await (const ev of team.run("Write a 200-word post about pgvector")) {
  if (ev.type === "token") process.stdout.write(ev.text);
}`}
        />

        <H3 id="orchestrator-py">Python</H3>
        <Code
          lang="python"
          code={`from relayhq import create_agent, create_orchestrator

researcher = create_agent(model="gpt-4o")
writer     = create_agent(model="claude-sonnet-4-6")
reviewer   = create_agent(model="claude-haiku-4-5")

team = create_orchestrator(
    model="claude-sonnet-4-6",
    agents={
        "research": {
            "agent": researcher,
            "description": "Researches topics and returns key facts.",
        },
        "write": {
            "agent": writer,
            "description": "Writes drafts from research notes.",
        },
        "review": {
            "agent": reviewer,
            "description": "Reviews drafts; returns approved or feedback.",
        },
    },
)

async for ev in team.run("Write a 200-word post about pgvector"):
    if ev.get("type") == "token":
        print(ev["text"], end="", flush=True)`}
        />

        <H3 id="orchestrator-extras">Extending the supervisor</H3>
        <P>
          Two escape hatches when the auto-generated prompt isn&apos;t
          enough:
        </P>
        <ul className="list-disc space-y-2 pl-5 text-ink-300">
          <li>
            <strong>
              <InlineCode>system: &quot;...&quot;</InlineCode>
            </strong>{" "}
            — appended after the team description. Use for output format
            rules, safety constraints, tone.
          </li>
          <li>
            <strong>
              <InlineCode>extraTools: [...]</InlineCode>
            </strong>{" "}
            — extra tools the supervisor can call directly, alongside
            teammates. Example: give the supervisor{" "}
            <InlineCode>builtin.calculator</InlineCode> so it can do simple
            math without delegating.
          </li>
        </ul>
        <Code
          lang="ts"
          code={`const team = createOrchestrator({
  model: "claude-sonnet-4-6",
  agents: { ... },
  system:
    "Always return the final answer as JSON: { summary, sources, confidence }.\\n" +
    "If teammates disagree, set confidence to 'low' and list both views.",
  extraTools: [builtin.calculator, getCurrentTime],
});`}
        />

        <H3 id="orchestrator-when">When NOT to use the orchestrator</H3>
        <P>If you find yourself doing any of these, drop down to the lower-level primitives:</P>
        <ul className="list-disc space-y-2 pl-5 text-ink-300">
          <li>
            <strong>Need a strict sequence</strong> (always research → write
            → review, no skipping) → use <InlineCode>Graph</InlineCode>.
            The LLM will deviate eventually.
          </li>
          <li>
            <strong>Need to pass typed state between agents</strong> → use{" "}
            <InlineCode>Graph</InlineCode>. The orchestrator passes a
            string prompt; not a struct.
          </li>
          <li>
            <strong>Need parallel fan-out</strong> → use{" "}
            <InlineCode>Graph</InlineCode> with{" "}
            <InlineCode>Promise.all</InlineCode> inside a step. The
            supervisor calls tools sequentially by default.
          </li>
          <li>
            <strong>You have one specialist agent</strong> → just use
            that agent directly. The supervisor layer is overhead.
          </li>
        </ul>
      </section>

      <section>
        <H2 id="graph">Graph — declarative pipelines</H2>
        <Mermaid chart={GRAPH_DIAGRAM} caption="research → write → review, with a feedback loop" />
        <P>
          When the flow is deterministic, the{" "}
          <InlineCode>Graph</InlineCode> API gives you nodes, edges, and
          state in a couple of chained calls. Every step becomes a Relay
          run linked under the same workflow.
        </P>
        <Code
          lang="ts"
          code={`import { createAgent, Graph, END } from "@relayhq/sdk";

const researcher = createAgent({ model: "gpt-4o" });
const writer     = createAgent({ model: "claude-sonnet-4-6" });
const reviewer   = createAgent({ model: "claude-haiku-4-5" });

type State = {
  topic: string;
  research?: string;
  draft?: string;
  verdict?: string;
};

const graph = new Graph<State>()
  .agent("research", researcher, { inputFrom: "topic",    outputTo: "research" })
  .agent("write",    writer,     { inputFrom: "research", outputTo: "draft" })
  .agent("review",   reviewer,   { inputFrom: "draft",    outputTo: "verdict" })
  .edge("research", "write")
  .edge("write", "review")
  .conditional("review", (state) =>
    state.verdict?.toLowerCase().includes("approved") ? END : "research",
  )
  .start("research");

const { state, path, workflowId } = await graph.run({ topic: "AI agents" });

console.log("path:",    path);        // ["research", "write", "review", ...]
console.log("draft:",   state.draft);
console.log("workflow:", workflowId);  // join all runs in the dashboard`}
        />

        <H3 id="graph-primitives">The primitives</H3>
        <ul className="list-disc space-y-2 pl-5 text-ink-300">
          <li>
            <InlineCode>{".step(name, fn)"}</InlineCode> — a raw step.{" "}
            <InlineCode>fn(state, ctx)</InlineCode> returns a partial state
            that gets merged in.
          </li>
          <li>
            <InlineCode>{".agent(name, agent, {inputFrom, outputTo})"}</InlineCode> —
            wrap a Relay agent as a step. Reads input from a state field,
            writes the final text to another state field.
          </li>
          <li>
            <InlineCode>{".edge(from, to)"}</InlineCode> — static
            transition. Pass <InlineCode>END</InlineCode> to terminate.
          </li>
          <li>
            <InlineCode>{".conditional(from, fn)"}</InlineCode> — dynamic
            transition. <InlineCode>fn(state)</InlineCode> returns the next
            step name (or <InlineCode>END</InlineCode>).
          </li>
          <li>
            <InlineCode>{".start(name)"}</InlineCode> — entry point.
            Defaults to the first step you registered.
          </li>
          <li>
            <InlineCode>{".describe()"}</InlineCode> — dump the graph
            shape. Used by the dashboard to render the flow before any run
            happens.
          </li>
        </ul>

        <H3 id="graph-safety">Safety: cycles and bounds</H3>
        <P>
          Cycles are allowed — feedback loops are useful — but every{" "}
          <InlineCode>run()</InlineCode> caps total step executions at{" "}
          <InlineCode>maxSteps</InlineCode> (default 30) and throws if
          exceeded. Override per call when you genuinely need more.
        </P>

        <H3 id="graph-py">Python</H3>
        <Code
          lang="python"
          code={`from relayhq import create_agent, Graph, END

graph = (
    Graph()
      .agent("research", researcher, input_from="topic", output_to="research")
      .agent("write",    writer,     input_from="research", output_to="draft")
      .agent("review",   reviewer,   input_from="draft",    output_to="verdict")
      .edge("research", "write")
      .edge("write", "review")
      .conditional("review", lambda s: END if "approved" in s["verdict"].lower() else "research")
      .start("research")
)

result = await graph.run({"topic": "AI agents"})
print(result.path, result.workflow_id)`}
        />
      </section>

      <section>
        <H2 id="when-which">When to use which</H2>
        <ul className="list-disc space-y-2 pl-5 text-ink-300">
          <li>
            <strong>subagent()</strong>: open-ended delegation, parent
            decides at runtime which sub-agent to call. Example: a support
            agent that calls a "refund_specialist" only when the user
            actually asks for a refund.
          </li>
          <li>
            <strong>Graph</strong>: deterministic pipeline with state.
            Example: ETL-style "ingest → enrich → summarize → publish"
            where every record goes through the same steps.
          </li>
          <li>
            <strong>Both, in the same workflow</strong>: a Graph step can
            itself be an agent with <InlineCode>subagent()</InlineCode>{" "}
            tools. They compose freely.
          </li>
        </ul>
        <Callout kind="note">
          The Graph runs in your process — Relay&apos;s control plane has
          no graph engine. That keeps Relay focused on the parts that
          actually need a server (memory, traces, tool broker, BYOK) and
          lets your workflows be whatever shape your code wants them to
          be.
        </Callout>
      </section>

      <section>
        <H2 id="observability">Inspecting a workflow</H2>
        <P>
          Every run in a workflow shares one{" "}
          <InlineCode>workflow_id</InlineCode> and links via{" "}
          <InlineCode>parent_run_id</InlineCode>. Two endpoints surface this:
        </P>
        <Code
          lang="bash"
          code={`# Tree of runs (depth-first, indented for rendering)
curl -H "Authorization: Bearer $RELAY_API_KEY" \\
     https://api.relaygh.dev/v1/workflows/<workflow_id>

# → { runs: [...], cost: { runCount, inputTokens, outputTokens } }

# Only top-level runs (one row per workflow in your dashboard)
curl -H "Authorization: Bearer $RELAY_API_KEY" \\
     "https://api.relaygh.dev/v1/runs?roots=true"`}
        />
      </section>

      <section>
        <H2 id="recipes">Recipes — patterns you&apos;ll actually build</H2>
        <P>
          The Graph and subagent primitives compose into the usual workflow
          shapes. Each recipe below is a complete, copy-pasteable example.
        </P>

        <H3 id="recipe-parallel">Parallel fan-out + aggregate</H3>
        <P>
          Run N agents on the same input concurrently, then aggregate the
          results. The Graph runner doesn&apos;t have built-in parallelism
          (steps are sequential), so we use the SDK directly inside a single
          step.
        </P>
        <Code
          lang="typescript"
          code={`import { createAgent, Graph, END, collectFinalOutput } from "@relayhq/sdk";

const researcher = createAgent({ model: "gpt-4o" });
const critic     = createAgent({ model: "claude-sonnet-4-6" });
const summarizer = createAgent({ model: "claude-haiku-4-5" });

type State = { topic: string; research?: string; critique?: string; summary?: string };

const graph = new Graph<State>()
  // ─── Fan out: research + critique run in parallel ──────────────────
  .step("gather", async (state, ctx) => {
    const [research, critique] = await Promise.all([
      collectFinalOutput(
        researcher.run(\`Research: \${state.topic}\`, {
          workflowId: ctx.workflowId,
        }),
      ),
      collectFinalOutput(
        critic.run(\`Identify counter-arguments to: \${state.topic}\`, {
          workflowId: ctx.workflowId,
        }),
      ),
    ]);
    return { research, critique };
  })
  // ─── Reduce: summarize both into one output ────────────────────────
  .agent("summarize", summarizer, { inputFrom: "research", outputTo: "summary" })
  .edge("gather", "summarize")
  .edge("summarize", END);

const result = await graph.run({ topic: "Whether to adopt CRDTs" });`}
        />
        <Callout kind="tip">
          Both sub-runs pass <InlineCode>workflowId: ctx.workflowId</InlineCode>{" "}
          so they share the parent&apos;s workflow tree. Cost aggregation via{" "}
          <InlineCode>GET /v1/workflows/:id</InlineCode> includes all of them.
        </Callout>

        <H3 id="recipe-retry">Retry loop with bounded attempts</H3>
        <P>
          Useful when an LLM step might produce invalid output (e.g.
          structured JSON that needs to validate against a schema, or code
          that needs to compile).
        </P>
        <Code
          lang="typescript"
          code={`import { Graph, END } from "@relayhq/sdk";

type State = {
  prompt: string;
  attempt: number;
  output?: string;
  valid?: boolean;
  feedback?: string;
};

const graph = new Graph<State>()
  .agent("generate", coder, { inputFrom: "prompt", outputTo: "output" })
  .step("validate", async (state) => {
    const result = await runTests(state.output!);
    return {
      valid: result.ok,
      feedback: result.ok ? undefined : result.errors,
      attempt: (state.attempt ?? 0) + 1,
      // Feed the failure back into the prompt for the next attempt
      prompt: result.ok
        ? state.prompt
        : \`\${state.prompt}\\n\\nPrevious attempt failed: \${result.errors}\\nFix and retry.\`,
    };
  })
  .edge("generate", "validate")
  .conditional("validate", (state) => {
    if (state.valid) return END;
    if (state.attempt >= 3) return END; // give up after 3
    return "generate";
  })
  .start("generate");

const result = await graph.run({ prompt: "Write a binary search in TS", attempt: 0 });`}
        />

        <H3 id="recipe-map-reduce">Map-reduce over a list</H3>
        <P>
          Process N items individually with the same agent, then aggregate.
          Useful for batch summaries, per-document analysis, parallel
          extraction.
        </P>
        <Code
          lang="python"
          code={`import asyncio
from relayhq import Graph, END, collect_final_output, create_agent

extractor = create_agent(model="gpt-4o-mini", system="Extract key facts as JSON.")
synthesizer = create_agent(model="claude-sonnet-4-6", system="Synthesize a coherent summary.")

graph = (
    Graph()
      # MAP: extract facts from each doc in parallel
      .step("map", lambda state, ctx: asyncio.gather(*[
          collect_final_output(
              extractor.run(doc, workflow_id=ctx.workflow_id or None)
          )
          for doc in state["docs"]
      ]).__await__() and {"facts": "..."})  # see TypeScript for cleaner version
      # REDUCE: synthesize all facts into one summary
      .agent("reduce", synthesizer, input_from="facts", output_to="summary")
      .edge("map", "reduce")
      .edge("reduce", END)
)

# In TypeScript the same pattern reads more naturally:
# .step("map", async (state, ctx) => ({
#   facts: (await Promise.all(state.docs.map(d =>
#     collectFinalOutput(extractor.run(d, { workflowId: ctx.workflowId }))
#   ))).join("\\n"),
# }))`}
        />

        <H3 id="recipe-branching">Branching by classification</H3>
        <P>
          First agent classifies the input; downstream agents handle each
          class. The conditional edge does the routing — no manual{" "}
          <InlineCode>if/else</InlineCode> chains needed.
        </P>
        <Code
          lang="typescript"
          code={`import { createAgent, Graph, END } from "@relayhq/sdk";

const classifier = createAgent({
  model: "gpt-4o-mini",
  system: 'Reply with one word: "refund", "shipping", "technical", or "other".',
});
const refundAgent     = createAgent({ model: "claude-sonnet-4-6", system: "..." });
const shippingAgent   = createAgent({ model: "gpt-4o-mini",       system: "..." });
const technicalAgent  = createAgent({ model: "claude-sonnet-4-6", system: "..." });
const escalationAgent = createAgent({ model: "claude-sonnet-4-6", system: "..." });

type State = { ticket: string; category?: string; response?: string };

const graph = new Graph<State>()
  .agent("classify", classifier, { inputFrom: "ticket", outputTo: "category" })
  .agent("refund",     refundAgent,     { inputFrom: "ticket", outputTo: "response" })
  .agent("shipping",   shippingAgent,   { inputFrom: "ticket", outputTo: "response" })
  .agent("technical",  technicalAgent,  { inputFrom: "ticket", outputTo: "response" })
  .agent("escalate",   escalationAgent, { inputFrom: "ticket", outputTo: "response" })
  .conditional("classify", (state) => {
    const cat = state.category?.toLowerCase().trim() ?? "";
    if (cat.includes("refund"))    return "refund";
    if (cat.includes("shipping"))  return "shipping";
    if (cat.includes("technical")) return "technical";
    return "escalate";
  })
  .edge("refund",    END)
  .edge("shipping",  END)
  .edge("technical", END)
  .edge("escalate",  END)
  .start("classify");

const { state } = await graph.run({ ticket: "I never got my package" });`}
        />

        <H3 id="recipe-debate">Multi-agent debate (until consensus or rounds)</H3>
        <P>
          Two agents argue opposite sides, a third judges. Cycles back if no
          consensus; bounded by total rounds.
        </P>
        <Code
          lang="typescript"
          code={`import { createAgent, Graph, END } from "@relayhq/sdk";

const proposer = createAgent({ model: "claude-sonnet-4-6", system: "Argue FOR the proposal." });
const opposer  = createAgent({ model: "claude-sonnet-4-6", system: "Argue AGAINST the proposal." });
const judge    = createAgent({
  model: "gpt-4o",
  system: 'After reading both sides, output exactly: "CONSENSUS: <verdict>" or "MORE_DEBATE_NEEDED".',
});

type State = {
  proposal: string;
  transcript: string[];
  round: number;
  verdict?: string;
};

const graph = new Graph<State>()
  .step("pro", async (state, ctx) => {
    const out = await collectFinalOutput(
      proposer.run(
        \`Proposal: \${state.proposal}\\n\\nTranscript so far:\\n\${state.transcript.join("\\n")}\`,
        { workflowId: ctx.workflowId },
      ),
    );
    return { transcript: [...state.transcript, \`PRO: \${out}\`] };
  })
  .step("con", async (state, ctx) => {
    const out = await collectFinalOutput(
      opposer.run(
        \`Proposal: \${state.proposal}\\n\\nTranscript so far:\\n\${state.transcript.join("\\n")}\`,
        { workflowId: ctx.workflowId },
      ),
    );
    return {
      transcript: [...state.transcript, \`CON: \${out}\`],
      round: state.round + 1,
    };
  })
  .step("judge", async (state, ctx) => {
    const out = await collectFinalOutput(
      judge.run(state.transcript.join("\\n"), { workflowId: ctx.workflowId }),
    );
    return { verdict: out };
  })
  .edge("pro", "con")
  .edge("con", "judge")
  .conditional("judge", (state) => {
    if (state.verdict?.startsWith("CONSENSUS:")) return END;
    if (state.round >= 5) return END; // hard cap
    return "pro"; // loop back
  })
  .start("pro");

const { state, path } = await graph.run({
  proposal: "Migrate from REST to GraphQL",
  transcript: [],
  round: 0,
});
console.log(\`Verdict after \${path.length} steps:\`, state.verdict);`}
        />

        <H3 id="recipe-human">Human-in-the-loop checkpoint</H3>
        <P>
          Workflow runs up to a step that requires human approval, persists
          state, exits. Resumed later via a separate run that picks up where
          it left off.
        </P>
        <P>
          The simplest version: the &quot;wait for approval&quot; step polls
          your own DB / queue for the human decision before continuing.
          (Relay doesn&apos;t persist workflow state itself — that&apos;s
          intentional, keeps the runner stateless and composable.)
        </P>
        <Code
          lang="typescript"
          code={`import { Graph, END } from "@relayhq/sdk";

const graph = new Graph()
  .agent("draft", drafter, { inputFrom: "brief", outputTo: "draft" })
  .step("await_approval", async (state) => {
    // Persist draft and an approval token to your own DB
    const token = await approvals.create({ draft: state.draft });

    // Notify a human (email, Slack, etc.)
    await slack.send(\`Approval needed: https://your-app/approvals/\${token}\`);

    // Block until approved or rejected. In a serverless world, end the
    // workflow here and resume from a webhook in a follow-up run. In a
    // long-lived worker, poll:
    const decision = await approvals.waitForDecision(token, { timeoutMs: 3600_000 });
    return { approved: decision.approved, feedback: decision.feedback };
  })
  .agent("publish",   publisher,    { inputFrom: "draft", outputTo: "published_url" })
  .agent("revise",    drafter,      { inputFrom: "feedback", outputTo: "draft" })
  .conditional("await_approval", (state) =>
    state.approved ? "publish" : "revise",
  )
  .edge("publish", END)
  .edge("revise",  "await_approval")
  .start("draft");`}
        />
      </section>

      <section>
        <H2 id="picking">Picking the right primitive</H2>
        <P>The rule of thumb, in increasing order of structure:</P>
        <ul className="list-disc space-y-2 pl-5 text-ink-300">
          <li>
            <strong>Single agent + tools</strong>: the model decides
            everything dynamically. Use when the flow is open-ended.
          </li>
          <li>
            <strong>subagent()</strong>: another agent <em>is</em> a tool.
            Use when the parent should sometimes delegate, but not always.
          </li>
          <li>
            <strong>createOrchestrator()</strong>: a supervisor LLM
            coordinating a team of specialists. Use when you want
            multi-agent without writing the routing logic. The fastest
            path from &quot;I have 3 agents&quot; to &quot;working
            multi-agent system&quot;.
          </li>
          <li>
            <strong>Graph</strong>: deterministic pipeline with steps and
            state. Use when you can describe the flow as a flowchart
            without thinking about the LLM.
          </li>
          <li>
            <strong>Graph with agent steps</strong>: pipeline structure with
            LLMs filling in specific roles. The most common
            production shape.
          </li>
        </ul>
      </section>
    </DocsPage>
  );
}
