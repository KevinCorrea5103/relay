#!/usr/bin/env node
// One-shot, idempotent setup. Safe to re-run.
//
// Steps (each step skips if already done):
//   1. .env from .env.example
//   2. RELAY_MASTER_KEY     (mints if missing)
//   3. RELAY_INTERNAL_SECRET (mints if missing)
//   4. build @relay/sdk and @relay/db
//   5. docker compose up postgres
//   6. apply DB migrations
//   7. bootstrap tenant + RELAY_API_KEY + provider credentials
//
// After setup, run `pnpm dev` to start the whole stack.

import { execSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ENV_PATH = join(ROOT, ".env");
const ENV_EXAMPLE = join(ROOT, ".env.example");

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

function readEnv() {
  if (!existsSync(ENV_PATH)) return {};
  const lines = readFileSync(ENV_PATH, "utf8").split("\n");
  const env = {};
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function setEnvVar(key, value) {
  const newLine = `${key}=${value}`;
  if (!existsSync(ENV_PATH)) {
    writeFileSync(ENV_PATH, newLine + "\n");
    return;
  }
  let content = readFileSync(ENV_PATH, "utf8");
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(content)) {
    content = content.replace(re, newLine);
  } else {
    if (!content.endsWith("\n")) content += "\n";
    content += newLine + "\n";
  }
  writeFileSync(ENV_PATH, content);
}

function run(cmd, opts = {}) {
  return execSync(cmd, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: opts.silent ? "pipe" : "inherit",
    env: { ...process.env, ...(opts.env || {}) },
  });
}

function step(label, fn) {
  process.stdout.write(`${c.cyan}▸${c.reset} ${label} `);
  try {
    const info = fn();
    process.stdout.write(`${c.green}✓${c.reset}`);
    if (info) process.stdout.write(` ${c.dim}${info}${c.reset}`);
    process.stdout.write("\n");
  } catch (err) {
    process.stdout.write(`${c.red}✗${c.reset}\n`);
    const msg = err.stderr?.toString?.() || err.message || String(err);
    console.error(`\n${c.red}${msg}${c.reset}`);
    process.exit(1);
  }
}

console.log(`\n${c.bold}Relay setup${c.reset} ${c.dim}— idempotent${c.reset}\n`);

// 1) .env
step(".env file", () => {
  if (existsSync(ENV_PATH)) return "already exists";
  if (!existsSync(ENV_EXAMPLE)) throw new Error(".env.example missing");
  copyFileSync(ENV_EXAMPLE, ENV_PATH);
  return "created from .env.example";
});

let env = readEnv();

// Helper: prefer existing value from .env or current shell.
function existing(key) {
  return env[key] || process.env[key] || "";
}

// 2) Master key
step("RELAY_MASTER_KEY", () => {
  const fromShell = existing("RELAY_MASTER_KEY");
  if (fromShell) {
    if (!env.RELAY_MASTER_KEY) {
      setEnvVar("RELAY_MASTER_KEY", fromShell);
      env.RELAY_MASTER_KEY = fromShell;
      return "imported from shell env";
    }
    return "already set in .env";
  }
  const out = run("pnpm -s db:keygen", { silent: true }).trim();
  const key = out.split("\n").pop().trim();
  if (!/^[0-9a-f]{64}$/.test(key)) throw new Error("unexpected keygen output: " + out);
  setEnvVar("RELAY_MASTER_KEY", key);
  env.RELAY_MASTER_KEY = key;
  return "generated and written to .env";
});

// 3) Internal secret
step("RELAY_INTERNAL_SECRET", () => {
  const fromShell = existing("RELAY_INTERNAL_SECRET");
  if (fromShell) {
    if (!env.RELAY_INTERNAL_SECRET) {
      setEnvVar("RELAY_INTERNAL_SECRET", fromShell);
      env.RELAY_INTERNAL_SECRET = fromShell;
      return "imported from shell env";
    }
    return "already set in .env";
  }
  const secret = randomBytes(32).toString("hex");
  setEnvVar("RELAY_INTERNAL_SECRET", secret);
  env.RELAY_INTERNAL_SECRET = secret;
  return "generated";
});

// 4) Build packages
step("Build @relay/sdk", () => {
  run("pnpm --filter @relay/sdk build", { silent: true });
});
step("Build @relay/db", () => {
  run("pnpm --filter @relay/db build", { silent: true });
});

// 5) Postgres
step("docker compose up postgres", () => {
  run("pnpm db:up", { silent: true });
});

// 6) Migrations
step("apply migrations", () => {
  run("pnpm db:migrate", { silent: true, env });
});

// 7) Bootstrap tenant + API key
step("bootstrap tenant + RELAY_API_KEY", () => {
  const fromShell = existing("RELAY_API_KEY");
  if (fromShell) {
    if (!env.RELAY_API_KEY) {
      setEnvVar("RELAY_API_KEY", fromShell);
      env.RELAY_API_KEY = fromShell;
      return `imported ${fromShell.slice(0, 18)}… from shell`;
    }
    return "RELAY_API_KEY already set, skipping bootstrap";
  }

  const hasAnthropic = !!existing("ANTHROPIC_API_KEY");
  const hasOpenAI = !!existing("OPENAI_API_KEY");
  if (!hasAnthropic && !hasOpenAI) {
    throw new Error(
      "Add at least one provider key to .env before bootstrap:\n" +
        "  ANTHROPIC_API_KEY=sk-ant-...\n" +
        "  OPENAI_API_KEY=sk-...",
    );
  }

  const out = run("pnpm -s db:bootstrap", { silent: true, env });
  const match = out.match(/relay_live_[A-Za-z0-9_-]+/);
  if (!match) throw new Error("bootstrap did not print a relay_live_… key:\n" + out);
  setEnvVar("RELAY_API_KEY", match[0]);
  env.RELAY_API_KEY = match[0];
  return `minted ${match[0].slice(0, 18)}…`;
});

console.log(
  `\n${c.green}✓${c.reset} Setup complete. ` +
    `Run ${c.bold}pnpm dev${c.reset} to start the whole stack.\n`,
);
console.log(
  `${c.dim}Services will come up on:\n` +
    `  runtime        :4100\n` +
    `  control-plane  :4000\n` +
    `  dashboard      :3000\n` +
    `  web            :3001${c.reset}\n`,
);
