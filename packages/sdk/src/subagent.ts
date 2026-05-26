import type { Agent } from "./agent.js";
import { tool } from "./tool.js";
import type { AgentEvent, FunctionTool, ToolContext } from "./types.js";

// ─── subagent() ─────────────────────────────────────────────────────────────
//
// Turn an Agent into a Tool that another Agent can call. When the parent's
// LLM decides to invoke the sub-agent, this handler runs `child.run(input)`
// linked to the parent run, drains the events, and returns the final output
// as the tool result. The whole tree of runs shares one workflow_id, so the
// dashboard can render the call graph and aggregate cost.
//
// Usage:
//   const researcher = createAgent({ model: "gpt-4o", tools: [web_search] });
//   const writer = createAgent({
//     model: "claude-sonnet-4-6",
//     tools: [
//       subagent({
//         name: "research",
//         description: "Research a topic and return key findings",
//         agent: researcher,
//       }),
//     ],
//   });
//
// Notes:
//   - `input` to the tool is `{ input: string }` by default; override the
//     schema if you want different fields. The handler reads `input` from
//     the args.
//   - Events from the sub-agent are NOT yielded into the parent stream —
//     only the final output is returned as the tool result. If you want to
//     surface progress, the parent can subscribe to the dashboard's
//     workflow tree endpoint (`GET /v1/workflows/:id`).
//   - Depth is capped at MAX_SUBAGENT_DEPTH to prevent runaway recursion.
//     Each subagent invocation increments depth via the SUBAGENT_DEPTH_KEY
//     in ctx (carried across via a closure on the handler).

const MAX_SUBAGENT_DEPTH = 5;

export type SubagentSpec = {
  name: string;
  description: string;
  agent: Agent;
  // Override the input schema. Default expects { input: string }.
  inputSchema?: Record<string, unknown>;
  // Cap recursion depth for THIS subagent specifically. Defaults to the
  // global ceiling.
  maxDepth?: number;
};

// Internal: thread-local-ish counter via WeakMap keyed on workflowId.
// Single-threaded JS means a simple Map keyed by workflow is fine.
const depthByWorkflow = new Map<string, number>();

export function subagent(spec: SubagentSpec): FunctionTool {
  const inputSchema = spec.inputSchema ?? {
    type: "object",
    properties: {
      input: { type: "string", description: "Prompt for the sub-agent" },
    },
    required: ["input"],
    additionalProperties: false,
  };
  const maxDepth = spec.maxDepth ?? MAX_SUBAGENT_DEPTH;

  return tool({
    name: spec.name,
    description: spec.description,
    inputSchema,
    handler: async (input: unknown, ctx?: ToolContext) => {
      const prompt = extractPrompt(input);
      if (!prompt) {
        return { error: "subagent expected { input: string }" };
      }

      const workflowKey = ctx?.workflowId ?? ctx?.runId ?? "anon";
      const current = depthByWorkflow.get(workflowKey) ?? 0;
      if (current >= maxDepth) {
        return {
          error: `subagent depth limit reached (${maxDepth}); refusing to recurse`,
        };
      }
      depthByWorkflow.set(workflowKey, current + 1);

      try {
        const sub = spec.agent.run(prompt, {
          parentRunId: ctx?.runId,
          workflowId: ctx?.workflowId ?? ctx?.runId,
          signal: ctx?.signal,
        });

        const segments: string[] = [];
        let usage: { input_tokens: number; output_tokens: number } | null = null;
        let lastError: string | null = null;

        for await (const ev of sub as AsyncIterable<AgentEvent>) {
          if (ev.type === "token") {
            segments.push(ev.text);
          } else if (ev.type === "done") {
            // The full output is also in ev.output; prefer it over the
            // streamed token sum since it reflects the model's final form.
            segments.length = 0;
            segments.push(ev.output);
            usage = ev.usage ?? null;
          } else if (ev.type === "error") {
            lastError = ev.message;
          }
        }

        if (lastError && segments.length === 0) {
          return { error: lastError };
        }

        return {
          output: segments.join(""),
          usage,
        };
      } finally {
        const after = (depthByWorkflow.get(workflowKey) ?? 1) - 1;
        if (after <= 0) {
          depthByWorkflow.delete(workflowKey);
        } else {
          depthByWorkflow.set(workflowKey, after);
        }
      }
    },
  });
}

function extractPrompt(input: unknown): string | null {
  if (typeof input === "string") return input;
  if (input && typeof input === "object" && "input" in input) {
    const v = (input as { input?: unknown }).input;
    if (typeof v === "string") return v;
  }
  return null;
}
