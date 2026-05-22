import { createAgent, builtin, tool, type ModelId } from "@relay/sdk";

const users: Record<string, { name: string; tier: string; balanceUsd: number }> = {
  u_001: { name: "Ada Lovelace", tier: "pro", balanceUsd: 1480.5 },
  u_002: { name: "Grace Hopper", tier: "free", balanceUsd: 12.0 },
  u_003: { name: "Alan Turing", tier: "enterprise", balanceUsd: 9320.75 },
};

const getUser = tool({
  name: "get_user",
  description: "Look up a user by id. Returns name, tier, and current balance in USD.",
  inputSchema: {
    type: "object",
    properties: { id: { type: "string", description: "user id, e.g. u_001" } },
    required: ["id"],
    additionalProperties: false,
  },
  async handler({ id }: { id: string }) {
    const user = users[id];
    if (!user) return { error: `no user with id ${id}` };
    return { id, ...user };
  },
});

const model: ModelId = (process.env.RELAY_MODEL as ModelId) ?? "claude-sonnet-4-6";

const agent = createAgent({
  model,
  system:
    "You are a helpful assistant. Use the calculator tool for arithmetic and " +
    "get_user to look up user info. Be concise.",
  tools: [builtin.calculator, getUser],
});

const prompt =
  process.argv.slice(2).join(" ") ||
  "Look up u_001 and u_003. What's the combined balance, and how much would 7% tax on it be?";

console.log(`[model=${model}] > ${prompt}\n`);

const run = agent.run(prompt);

for await (const event of run) {
  switch (event.type) {
    case "token":
      process.stdout.write(event.text);
      break;
    case "tool_call":
      process.stdout.write(`\n→ ${event.name}(${JSON.stringify(event.input)})`);
      break;
    case "tool_result":
      process.stdout.write(` = ${JSON.stringify(event.output)}\n`);
      break;
    case "done":
      process.stdout.write(`\n\n[done] usage=${JSON.stringify(event.usage ?? {})}\n`);
      break;
    case "error":
      console.error(`\n[error] ${event.message}`);
      process.exit(1);
  }
}
