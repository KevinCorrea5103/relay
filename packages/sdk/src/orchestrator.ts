// ─── createOrchestrator() ──────────────────────────────────────────────────
//
// Higher-level wrapper for the "supervisor" pattern: one LLM coordinates a
// team of specialist agents. The supervisor sees each agent as a tool it
// can call, picks who to delegate to based on the request, and stitches the
// results back together.
//
// Under the hood this is just:
//   - createAgent({ model, system, tools: [subagent(a), subagent(b), ...] })
//
// The win is that you don't write the system prompt by hand. We auto-
// generate it from the team description so the LLM knows what each
// teammate is good at.
//
// For other orchestration shapes — strictly sequential pipelines,
// parallel fan-out, or stateful loops — use the `Graph` primitive directly.
// This wrapper handles the "supervisor decides who to call" case.

import { createAgent, type Agent } from "./agent.js";
import { subagent } from "./subagent.js";
import type { AgentConfig, ModelId, Tool } from "./types.js";

export type TeammateSpec = {
  // The Agent that does the actual work.
  agent: Agent;
  // One-sentence description of the teammate's specialty — fed into the
  // supervisor's system prompt so the LLM knows when to call them.
  description: string;
  // Override the JSON Schema for the call args. Default expects { input: string }.
  inputSchema?: Record<string, unknown>;
};

export type OrchestratorConfig = {
  // The supervisor's brain. Smarter models route better; gpt-4o or
  // claude-sonnet-4-6 are good defaults.
  model: ModelId;
  // Team of named agents. The key becomes the tool name (snake_case
  // recommended).
  agents: Record<string, TeammateSpec>;
  // Custom supervisor instructions appended after the auto-generated team
  // description. Use for output format constraints, safety rules, etc.
  system?: string;
  // Extra tools the supervisor can call directly (in addition to the team).
  extraTools?: Tool[];
  // Forwarded to the underlying createAgent.
  apiKey?: string;
  baseUrl?: string;
  memory?: AgentConfig["memory"];
};

export function createOrchestrator(config: OrchestratorConfig): Agent {
  const names = Object.keys(config.agents);
  if (names.length === 0) {
    throw new Error("createOrchestrator: at least one agent in `agents` required");
  }

  const teamDescription = names
    .map((name) => `  - ${name}: ${config.agents[name]!.description}`)
    .join("\n");

  const autoSystem =
    "You coordinate a team of specialist agents. Decide which teammate is " +
    "best suited for each part of the user's request, call them as tools, " +
    "and synthesize their outputs into a final response.\n\n" +
    "Available teammates:\n" +
    teamDescription +
    "\n\n" +
    "Guidelines:\n" +
    "  - Call only the teammates you need; don't fan out to everyone by default.\n" +
    "  - Pass each teammate a focused, specific prompt — not the whole user query verbatim.\n" +
    "  - When a teammate's output is sufficient, return it (with any required reformatting). " +
    "Don't call another teammate just to paraphrase.\n" +
    "  - If teammates disagree, surface the disagreement to the user; don't pick a side silently.";

  const system = config.system
    ? `${autoSystem}\n\n${config.system}`
    : autoSystem;

  const teamTools: Tool[] = names.map((name) =>
    subagent({
      name,
      description: config.agents[name]!.description,
      agent: config.agents[name]!.agent,
      inputSchema: config.agents[name]!.inputSchema,
    }),
  );

  return createAgent({
    model: config.model,
    system,
    tools: [...teamTools, ...(config.extraTools ?? [])],
    memory: config.memory,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
  });
}

// Convenience: returns the auto-generated system prompt without actually
// constructing an Agent. Useful for inspecting / customizing before
// instantiation.
export function describeTeam(agents: Record<string, TeammateSpec>): string {
  return Object.entries(agents)
    .map(([name, spec]) => `${name}: ${spec.description}`)
    .join("\n");
}
