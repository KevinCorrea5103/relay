import { Code } from "@/components/Code";
import { Callout, DocsPage, H2, H3, InlineCode, P, Table, Td, Th } from "@/components/DocsPage";

export default async function SecurityDocs({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return (
    <DocsPage
      slug="security"
      lang={lang}
      title="Security"
      description="Row-Level Security in Postgres, dual-key envelope encryption, audit log, API key rotation, rate limiting. Defense in depth, not theater."
    >
      <section>
        <H2 id="model">Tenant isolation, layered</H2>
        <P>
          Every tenant-scoped row carries a{" "}
          <InlineCode>tenant_id</InlineCode>. Five layers enforce isolation
          so a single bug in any one of them doesn&apos;t leak data:
        </P>
        <ol className="list-decimal space-y-2 pl-5 text-ink-300">
          <li>
            <strong>API key → tenant resolution</strong> at the edge:
            bearer hashed (SHA-256), looked up in{" "}
            <InlineCode>api_keys</InlineCode>, the tenant id is bound to
            the request context for everything downstream.
          </li>
          <li>
            <strong>Application-layer scoping</strong>: every repo function
            in <InlineCode>@relayhq/db</InlineCode> takes a tenant id and
            filters on it. The compiler enforces it.
          </li>
          <li>
            <strong>Postgres Row-Level Security</strong>: even if the SQL
            forgets a <InlineCode>WHERE</InlineCode>, the database itself
            denies the rows. See below.
          </li>
          <li>
            <strong>Non-owner DB role</strong>: the control plane connects
            as <InlineCode>relay_app</InlineCode> which has no{" "}
            <InlineCode>BYPASSRLS</InlineCode>. Admin scripts use a
            separate role.
          </li>
          <li>
            <strong>Per-tenant encryption</strong>: provider credentials
            are AES-256-GCM sealed with the master key, with a dual-key
            rotation path.
          </li>
        </ol>
      </section>

      <section>
        <H2 id="rls">Row-Level Security</H2>
        <P>
          Migration 004 enables RLS on every tenant-scoped table:{" "}
          <InlineCode>tenants</InlineCode>, <InlineCode>api_keys</InlineCode>,{" "}
          <InlineCode>provider_credentials</InlineCode>,{" "}
          <InlineCode>runs</InlineCode>, <InlineCode>run_events</InlineCode>,{" "}
          <InlineCode>memories</InlineCode>,{" "}
          <InlineCode>audit_events</InlineCode>. The policy is uniform:
        </P>
        <Code
          lang="sql"
          code={`-- Visible iff the row is yours OR the admin escape hatch is set.
USING (
  coalesce(current_setting('app.bypass_rls', true), '') = 'on'
  OR tenant_id::text = nullif(current_setting('app.tenant_id', true), '')
)`}
        />
        <P>
          The control plane wraps every tenant-scoped request in a
          transaction with{" "}
          <InlineCode>SET LOCAL app.tenant_id = ?</InlineCode>. Without
          that variable set, the policy hides all rows —{" "}
          <em>safe by default</em>. Admin contexts (signup, internal
          callbacks, migrations) set <InlineCode>app.bypass_rls = &apos;on&apos;</InlineCode>{" "}
          explicitly.
        </P>
        <Callout kind="tip">
          To verify: connect as <InlineCode>relay_app</InlineCode>{" "}
          (the non-owner role) and{" "}
          <InlineCode>SELECT * FROM runs</InlineCode> without setting{" "}
          <InlineCode>app.tenant_id</InlineCode>. You get zero rows. Set
          the variable to a tenant&apos;s UUID — you see only that
          tenant&apos;s runs.
        </Callout>
      </section>

      <section>
        <H2 id="encryption">Encryption at rest (BYOK)</H2>
        <P>
          Provider credentials never live in plaintext. The lifecycle:
        </P>
        <ul className="list-disc space-y-2 pl-5 text-ink-300">
          <li>
            <strong>Seal</strong>: when you{" "}
            <InlineCode>PUT /v1/credentials/&lt;provider&gt;</InlineCode>,
            the control plane encrypts the key with AES-256-GCM using{" "}
            <InlineCode>RELAY_MASTER_KEY</InlineCode>, stores ciphertext +
            IV + auth tag.
          </li>
          <li>
            <strong>Open</strong>: when a run needs to call OpenAI /
            Anthropic, the control plane decrypts on the fly and ships
            plaintext in the per-request payload to the runtime. The
            runtime never persists it.
          </li>
          <li>
            <strong>Rotate</strong>: dual-key envelope. Set{" "}
            <InlineCode>RELAY_MASTER_KEY_PREVIOUS</InlineCode> to the old
            key, flip <InlineCode>RELAY_MASTER_KEY</InlineCode> to the new
            one. <InlineCode>open()</InlineCode> tries primary first,
            falls back to secondary — so old rows keep working through the
            cutover.
          </li>
          <li>
            <strong>Re-encrypt</strong>:{" "}
            <InlineCode>pnpm db:rotate-master-key</InlineCode> scans every
            row, decrypts with whichever key works, re-encrypts with the
            new primary, writes an{" "}
            <InlineCode>audit_events</InlineCode> row per tenant. Once
            done, unset <InlineCode>RELAY_MASTER_KEY_PREVIOUS</InlineCode>.
          </li>
        </ul>
      </section>

      <section>
        <H2 id="api-keys">API key rotation</H2>
        <P>
          Tenants own their bearer tokens. The typical zero-downtime
          rotation:
        </P>
        <Code
          lang="bash"
          code={`# 1. Mint a new key
curl -X POST https://api.relaygh.dev/v1/keys \\
  -H "Authorization: Bearer $OLD_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"rotated 2026-05"}'

# Response: { "apiKey": "relay_live_...NEW", "descriptor": {...} }

# 2. Deploy the new key to your clients, verify it works

# 3. Revoke the old one
curl -X DELETE https://api.relaygh.dev/v1/keys/<old_key_id> \\
  -H "Authorization: Bearer $NEW_KEY"`}
        />
        <Callout kind="warn">
          The endpoint refuses to revoke the key used for the call unless
          you pass <InlineCode>?force=true</InlineCode>. Accidental
          self-revocation locks you out — the hashed secret can&apos;t be
          recovered.
        </Callout>
      </section>

      <section>
        <H2 id="audit-log">Audit log</H2>
        <P>
          Every security-relevant action lands in{" "}
          <InlineCode>audit_events</InlineCode>, scoped per tenant and
          RLS-protected like everything else. Indexed by{" "}
          <InlineCode>(tenant_id, created_at)</InlineCode> and{" "}
          <InlineCode>(tenant_id, action, created_at)</InlineCode>.
        </P>
        <Table>
          <thead>
            <tr>
              <Th>Action</Th>
              <Th>Emitted on</Th>
            </tr>
          </thead>
          <tbody>
            <tr><Td mono>tenant.signed_up</Td>      <Td>POST /v1/signup</Td></tr>
            <tr><Td mono>api_key.created</Td>       <Td>POST /v1/keys</Td></tr>
            <tr><Td mono>api_key.revoked</Td>       <Td>DELETE /v1/keys/:id</Td></tr>
            <tr><Td mono>credential.created</Td>    <Td>PUT /v1/credentials/:provider (new)</Td></tr>
            <tr><Td mono>credential.updated</Td>    <Td>PUT /v1/credentials/:provider (replace)</Td></tr>
            <tr><Td mono>credential.deleted</Td>    <Td>DELETE /v1/credentials/:provider</Td></tr>
            <tr><Td mono>master_key.rotated</Td>    <Td>pnpm db:rotate-master-key</Td></tr>
            <tr><Td mono>memory.deleted</Td>        <Td>DELETE /v1/memories/:id</Td></tr>
            <tr><Td mono>memory.namespace_cleared</Td><Td>DELETE /v1/memories?namespace=…</Td></tr>
            <tr><Td mono>voice.transcribed</Td>     <Td>POST /v1/transcribe</Td></tr>
            <tr><Td mono>voice.synthesized</Td>     <Td>POST /v1/synthesize</Td></tr>
          </tbody>
        </Table>
        <Code
          lang="bash"
          code={`# Read your audit log
curl -H "Authorization: Bearer $RELAY_API_KEY" \\
     "https://api.relaygh.dev/v1/audit?action=api_key.created&limit=50"`}
        />
      </section>

      <section>
        <H2 id="rate-limits">Rate limiting</H2>
        <P>
          Per-tenant token-bucket on every <InlineCode>/v1/*</InlineCode>{" "}
          endpoint. Two classes:
        </P>
        <Table>
          <thead>
            <tr>
              <Th>Class</Th>
              <Th>Capacity</Th>
              <Th>Refill</Th>
              <Th>Applies to</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td mono>default</Td>
              <Td>60</Td>
              <Td>60/min</Td>
              <Td>All authenticated reads</Td>
            </tr>
            <tr>
              <Td mono>runs</Td>
              <Td>30</Td>
              <Td>30/min</Td>
              <Td>POST /v1/runs</Td>
            </tr>
          </tbody>
        </Table>
        <P>
          Backend: in-memory per replica by default; set{" "}
          <InlineCode>REDIS_URL</InlineCode> to enforce fleet-wide via an
          atomic Lua script (required once you scale the control plane to
          &gt;1 instance).
        </P>
        <P>
          Limit-exceeded responses are HTTP <InlineCode>429</InlineCode>{" "}
          with <InlineCode>Retry-After</InlineCode> (seconds),{" "}
          <InlineCode>RateLimit-Limit</InlineCode>,{" "}
          <InlineCode>RateLimit-Remaining</InlineCode>, and{" "}
          <InlineCode>RateLimit-Reset</InlineCode> headers.
        </P>
      </section>

      <section>
        <H2 id="checklist">Production checklist</H2>
        <ul className="list-disc space-y-2 pl-5 text-ink-300">
          <li>
            <InlineCode>RELAY_MASTER_KEY</InlineCode> set (32 bytes,
            hex/base64). Never commit. Rotate every ~90 days using the
            dual-key procedure.
          </li>
          <li>
            <InlineCode>DATABASE_URL_APP</InlineCode> set to the{" "}
            <InlineCode>relay_app</InlineCode> role string. The admin{" "}
            <InlineCode>DATABASE_URL</InlineCode> stays scoped to
            migrations + bootstrap.
          </li>
          <li>
            <InlineCode>REDIS_URL</InlineCode> set if running &gt;1 control
            plane replica (otherwise rate limits are per-replica only).
          </li>
          <li>
            <InlineCode>NATS_URL</InlineCode> set if running &gt;1 control
            plane replica (the custom-tool broker has to be shared).
          </li>
          <li>
            Cross-vendor backups of Postgres to S3 / R2 nightly, restore
            test quarterly.
          </li>
          <li>
            <InlineCode>RELAY_INTERNAL_SECRET</InlineCode> set so only the
            runtime can call <InlineCode>/internal/*</InlineCode>.
          </li>
        </ul>
        <P>
          See the full <a className="text-emerald-300 hover:text-emerald-200" href="https://github.com/KevinCorrea5103/relay/blob/main/docs/DEPLOY_RUNBOOK.md">deploy runbook</a> for the staged rollout.
        </P>
      </section>
    </DocsPage>
  );
}
