// Orchestrates the integration suite. Sets default env, runs each test
// script in sequence, fails fast on the first non-zero exit.

import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// Defaults match docker-compose. CI overrides via env.
const env = {
  ...process.env,
  DATABASE_URL:
    process.env.DATABASE_URL ?? "postgres://relay:relay@localhost:5434/relay",
  DATABASE_URL_APP:
    process.env.DATABASE_URL_APP ??
    "postgres://relay_app:relay_app@localhost:5434/relay",
  NATS_URL: process.env.NATS_URL ?? "nats://localhost:4222",
  REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
  CLICKHOUSE_URL:
    process.env.CLICKHOUSE_URL ?? "http://relay:relay@localhost:8123/relay",
};

const files = (await readdir(here))
  .filter((f) => /^\d+-.+\.mjs$/.test(f))
  .sort();

if (files.length === 0) {
  console.error("no integration test files found");
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  console.log(`\n━━━ ${file} ━━━`);
  const code = await runOne(join(here, file), env);
  if (code !== 0) {
    failed += 1;
    console.error(`✗ ${file} exited ${code}`);
    // Fail fast: an early failure usually invalidates later assumptions.
    break;
  }
}

if (failed > 0) {
  console.error(`\n${failed} test file(s) failed`);
  process.exit(1);
}
console.log("\n✓ all integration tests passed");

function runOne(path, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path], { stdio: "inherit", env });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}
