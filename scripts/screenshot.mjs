#!/usr/bin/env node
// Generates dashboard screenshots for README + landing.
// Requires: a running dashboard at DASHBOARD_URL with at least one completed run.

import { chromium } from "playwright";
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const DASHBOARD_URL = process.env.DASHBOARD_URL ?? "http://localhost:3000";
const RUN_ID = process.env.RUN_ID ?? "7ec9fdb3-7ff5-4899-9e8c-7a004b27f1ff";

const REPO_OUT = join(process.cwd(), "docs", "screenshots");
const WEB_OUT = join(process.cwd(), "apps", "web", "public", "screenshots");

mkdirSync(REPO_OUT, { recursive: true });
mkdirSync(WEB_OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2, // retina-quality PNGs
});
const page = await ctx.newPage();

async function shoot(path, file) {
  await page.goto(`${DASHBOARD_URL}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400); // let fonts settle
  const target = join(REPO_OUT, file);
  await page.screenshot({ path: target, fullPage: true });
  copyFileSync(target, join(WEB_OUT, file));
  console.log(`  ✓ ${file}`);
}

console.log("Capturing dashboard screenshots…");
await shoot("/", "dashboard-list.png");
await shoot(`/runs/${RUN_ID}`, "dashboard-trace.png");

await browser.close();
console.log(`\nSaved to:`);
console.log(`  ${REPO_OUT}/*.png`);
console.log(`  ${WEB_OUT}/*.png`);
