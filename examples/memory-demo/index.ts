import { createAgent, type ModelId } from "@relayhq/sdk";

const model: ModelId = (process.env.RELAY_MODEL as ModelId) ?? "gpt-4o-mini";
const namespace = process.env.RELAY_MEMORY_NAMESPACE ?? "demo-user-kevin";

const agent = createAgent({
  model,
  memory: { namespace },
  system:
    "You are a helpful assistant. Be concise. If the user has shared facts about themselves before, refer to them naturally.",
});

const FIRST = "I'm Kevin. I drink only espresso, never lattes. My favorite city is Tokyo. Remember this.";
const SECOND = "What's my favorite city, and what coffee do I drink?";

async function runOnce(label: string, prompt: string) {
  console.log(`\n=== ${label} ===`);
  console.log(`> ${prompt}\n`);
  let output = "";
  for await (const event of agent.run(prompt)) {
    switch (event.type) {
      case "token":
        process.stdout.write(event.text);
        output += event.text;
        break;
      case "done":
        process.stdout.write(`\n[done] usage=${JSON.stringify(event.usage ?? {})}\n`);
        break;
      case "error":
        console.error(`\n[error] ${event.message}`);
        process.exit(1);
    }
  }
  return output;
}

async function main() {
  console.log(`[model=${model}] [namespace=${namespace}]`);
  console.log(
    `tip: re-run this script. The 2nd call recalls what was told in any previous run.`,
  );

  await runOnce("RUN 1 — teaches the agent", FIRST);
  await runOnce("RUN 2 — recalls", SECOND);

  console.log(`\nDone. Check the dashboard — RUN 2 should have a memory_retrieved event.`);
}

main();
