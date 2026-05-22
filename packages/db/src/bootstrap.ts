import { getPool } from "./client.js";
import {
  createTenant,
  findTenantByName,
  type Tenant,
} from "./tenants.js";
import { mintApiKey } from "./api-keys.js";
import { upsertCredential, type ProviderName } from "./credentials.js";
import { generateMasterKey } from "./encryption.js";

const TENANT_NAME = process.env.RELAY_TENANT_NAME ?? "default";

async function ensureTenant(name: string): Promise<Tenant> {
  const existing = await findTenantByName(name);
  if (existing) return existing;
  return createTenant(name);
}

async function maybeStoreCred(
  tenantId: string,
  provider: ProviderName,
  envVar: string,
): Promise<boolean> {
  const apiKey = process.env[envVar];
  if (!apiKey) return false;
  await upsertCredential({
    tenantId,
    provider,
    apiKey,
    label: `from $${envVar}`,
    baseUrl: provider === "openai" ? process.env.OPENAI_BASE_URL : undefined,
  });
  return true;
}

async function main() {
  if (!process.env.RELAY_MASTER_KEY) {
    const suggested = generateMasterKey();
    console.warn(
      "\n[bootstrap] RELAY_MASTER_KEY is not set.\n" +
        "  Credentials will be sealed with an ephemeral key and become\n" +
        "  unreadable after this process exits.\n\n" +
        "  Set this in your env to persist credentials across restarts:\n" +
        `    export RELAY_MASTER_KEY=${suggested}\n`,
    );
  }

  const tenant = await ensureTenant(TENANT_NAME);
  console.log(`[bootstrap] tenant: ${tenant.name} (${tenant.id})`);

  const minted = await mintApiKey({
    tenantId: tenant.id,
    name: "bootstrap key",
  });
  console.log(`[bootstrap] new api key (save this — will not be shown again):\n`);
  console.log(`    ${minted.secret}\n`);

  const stored: string[] = [];
  if (await maybeStoreCred(tenant.id, "anthropic", "ANTHROPIC_API_KEY")) {
    stored.push("anthropic (from $ANTHROPIC_API_KEY)");
  }
  if (await maybeStoreCred(tenant.id, "openai", "OPENAI_API_KEY")) {
    stored.push("openai (from $OPENAI_API_KEY)");
  }
  if (stored.length === 0) {
    console.log(
      `[bootstrap] no provider credentials stored\n` +
        `  → set ANTHROPIC_API_KEY and/or OPENAI_API_KEY before bootstrap, or\n` +
        `    upload later: curl -X PUT http://localhost:4000/v1/credentials/openai \\\n` +
        `                     -H "authorization: Bearer ${minted.secret}" \\\n` +
        `                     -H "content-type: application/json" \\\n` +
        `                     -d '{"apiKey":"sk-..."}'\n`,
    );
  } else {
    console.log(`[bootstrap] stored credentials:`);
    for (const s of stored) console.log(`  - ${s}`);
  }

  console.log(`\n[bootstrap] next: export RELAY_API_KEY=${minted.secret}\n`);

  await getPool().end();
}

main().catch((err) => {
  console.error("[bootstrap] failed:", err);
  process.exit(1);
});
