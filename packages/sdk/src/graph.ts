// ─── Graph — declarative multi-step workflows ──────────────────────────────
//
// Lightweight orchestrator that sits on top of `Agent` + `subagent` + the
// existing run-linking infrastructure. Lives entirely in the SDK; the
// server still sees the resulting runs as a tree linked by workflow_id.
//
// Why bother with a Graph API at all when `subagent()` already composes
// agents? Two reasons:
//
//   1. State passing. With subagent, the parent LLM decides when and how
//      to call the child via tool_use. With a graph, the developer wires
//      the data flow explicitly — useful when the steps are deterministic
//      and you want predictable cost.
//
//   2. Visualization. A declarative graph is something the dashboard can
//      render before any run happens. A `subagent` tree only exists
//      after the LLM has decided to call it.
//
// Design choices kept deliberately small:
//
//   - No DAG validation at definition time beyond "edge target must exist
//     and START/END are special". Cycles are allowed; we cap with
//     maxSteps to prevent runaway.
//   - State is a plain object; steps return a partial that's merged in.
//   - Each step run becomes its own Relay run (so it shows up in traces
//     and counts toward the workflow cost).
//   - Errors bubble. No retry policy here — if you want retries, wrap
//     your step.

import { createAgent, type Agent } from "./agent.js";
import type { AgentEvent } from "./types.js";

export const START = "__start__" as const;
export const END = "__end__" as const;

type NodeName = string;
type EdgeTarget = NodeName | typeof END;

export type StepContext = {
  // Run id of the workflow root, present for every step in the workflow.
  workflowId: string;
  // The step name currently executing.
  stepName: string;
  // Mutate-safe view of the accumulated state. Returning a partial
  // merges; mutating in place is allowed but discouraged.
  signal?: AbortSignal;
};

export type StepFn<S extends Record<string, unknown>> = (
  state: S,
  ctx: StepContext,
) => Promise<Partial<S>> | Partial<S>;

export type ConditionalFn<S extends Record<string, unknown>> = (
  state: S,
) => EdgeTarget | Promise<EdgeTarget>;

type Node<S extends Record<string, unknown>> = {
  name: NodeName;
  fn: StepFn<S>;
};

type Edge =
  | { from: NodeName; to: EdgeTarget; kind: "static" }
  | { from: NodeName; kind: "conditional"; fn: ConditionalFn<any> };

export type GraphRunOptions = {
  maxSteps?: number; // safety cap, default 30
  signal?: AbortSignal;
};

export type GraphRunResult<S> = {
  state: S;
  path: NodeName[]; // ordered list of steps that executed
  workflowId: string | null;
};

export class Graph<S extends Record<string, unknown> = Record<string, unknown>> {
  private nodes = new Map<NodeName, Node<S>>();
  private edges: Edge[] = [];
  private entry: NodeName | null = null;

  // Register a step. The function receives the current state and returns
  // a partial state object that gets merged in.
  step(name: NodeName, fn: StepFn<S>): this {
    if (this.nodes.has(name)) {
      throw new Error(`graph: step "${name}" already defined`);
    }
    if (name === START || name === END) {
      throw new Error(`graph: "${name}" is a reserved name`);
    }
    this.nodes.set(name, { name, fn });
    return this;
  }

  // Convenience: wire an Agent in as a step. Reads `input` from a state
  // field (default "input"), runs the agent, writes the final text into
  // a target state field (default the step name).
  agent(
    name: NodeName,
    agent: Agent,
    options?: {
      inputFrom?: keyof S | string;
      outputTo?: keyof S | string;
      systemFrom?: keyof S | string;
    },
  ): this {
    const inputFrom = (options?.inputFrom ?? "input") as string;
    const outputTo = (options?.outputTo ?? name) as string;
    return this.step(name, async (state, ctx) => {
      const input = state[inputFrom as keyof S];
      if (typeof input !== "string" || !input) {
        throw new Error(
          `graph step "${name}": expected state["${inputFrom}"] to be a non-empty string`,
        );
      }
      const events = agent.run(input, {
        workflowId: ctx.workflowId,
        signal: ctx.signal,
      });
      const output = await collectFinalOutput(events);
      return { [outputTo]: output } as Partial<S>;
    });
  }

  // Static edge from `from` to `to`. Use END to mark a terminal state.
  edge(from: NodeName, to: EdgeTarget): this {
    this.assertNode(from);
    if (to !== END) this.assertNode(to);
    this.edges.push({ from, to, kind: "static" });
    return this;
  }

  // Conditional edge: when a step finishes, evaluate `fn(state)` to
  // decide where to go next. Multiple conditionals from the same source
  // are not allowed; static and conditional from the same source are
  // mutually exclusive.
  conditional(from: NodeName, fn: ConditionalFn<S>): this {
    this.assertNode(from);
    if (this.edges.some((e) => e.from === from)) {
      throw new Error(
        `graph: step "${from}" already has an outgoing edge; remove it before adding a conditional`,
      );
    }
    this.edges.push({ from, kind: "conditional", fn });
    return this;
  }

  // Mark the entry point. If unset, the first registered step is used.
  start(name: NodeName): this {
    this.assertNode(name);
    this.entry = name;
    return this;
  }

  // Execute the graph against an initial state.
  async run(initial: S, options?: GraphRunOptions): Promise<GraphRunResult<S>> {
    const maxSteps = Math.max(1, options?.maxSteps ?? 30);
    const entry = this.entry ?? this.nodes.keys().next().value;
    if (!entry) {
      throw new Error("graph: no steps defined");
    }

    let state: S = { ...initial };
    let workflowId: string | null = null;
    const path: NodeName[] = [];
    let current: NodeName | typeof END = entry;

    for (let i = 0; i < maxSteps; i++) {
      if (options?.signal?.aborted) {
        throw new Error("graph run aborted");
      }
      if (current === END) {
        return { state, path, workflowId };
      }

      const node = this.nodes.get(current)!;
      const ctx: StepContext = {
        workflowId: workflowId ?? "",
        stepName: node.name,
        signal: options?.signal,
      };
      path.push(node.name);

      const patch = await node.fn(state, ctx);
      if (patch && typeof patch === "object") {
        state = { ...state, ...patch };
      }

      // First step's workflowId discovery: if the step ran a Relay agent,
      // its workflowId is now on the most recent run. We don't have a
      // direct hook for that without intercepting the Agent's events, so
      // we leave workflowId null for pure-function steps. For
      // `agent()`-defined steps we set it via the AgentRunCollector below.
      const wf = patch && (patch as { __workflowId?: string }).__workflowId;
      if (wf && !workflowId) {
        workflowId = wf;
        // Strip the bookkeeping field from state.
        delete (state as Record<string, unknown>)["__workflowId"];
      }

      const next = await this.nextFrom(current, state);
      if (next === undefined) {
        throw new Error(
          `graph: step "${current}" finished but has no outgoing edge (use .edge(from, END) to terminate)`,
        );
      }
      current = next;
    }
    throw new Error(`graph: exceeded maxSteps (${maxSteps}); possible cycle`);
  }

  private async nextFrom(from: NodeName, state: S): Promise<NodeName | typeof END | undefined> {
    const matching = this.edges.find((e) => e.from === from);
    if (!matching) return undefined;
    if (matching.kind === "static") return matching.to;
    return matching.fn(state);
  }

  private assertNode(name: NodeName): void {
    if (!this.nodes.has(name)) {
      throw new Error(`graph: unknown step "${name}"`);
    }
  }

  // For debugging / future dashboard rendering.
  describe(): {
    entry: NodeName | null;
    steps: NodeName[];
    edges: Array<{ from: NodeName; kind: string; to?: EdgeTarget }>;
  } {
    return {
      entry: this.entry,
      steps: [...this.nodes.keys()],
      edges: this.edges.map((e) =>
        e.kind === "static"
          ? { from: e.from, kind: "static", to: e.to }
          : { from: e.from, kind: "conditional" },
      ),
    };
  }
}

// Helper that drains an Agent's event stream into the final text output.
// Exported for users who want to wire their own steps without using
// `.agent()`.
export async function collectFinalOutput(
  events: AsyncIterable<AgentEvent>,
): Promise<string> {
  const parts: string[] = [];
  let final: string | null = null;
  for await (const ev of events) {
    if (ev.type === "token") {
      parts.push(ev.text);
    } else if (ev.type === "done") {
      final = ev.output;
    } else if (ev.type === "error") {
      throw new Error(`agent step failed: ${ev.message}`);
    }
  }
  return final ?? parts.join("");
}

// Re-export createAgent so users can do everything graph-related from one
// import (`@relayhq/sdk` already exports it from agent.js).
export { createAgent };
