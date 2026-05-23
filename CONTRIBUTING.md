# Contributing to Relay

Relay is open source under Apache 2.0. We welcome bug reports, fixes, docs, and
new features.

This guide is the shortest path from clone to merged PR.

## Quick setup

Prereqs: Node 20+, pnpm 9+, Go 1.22+, Docker.

```bash
git clone https://github.com/KevinCorrea5103/relay
cd relay
pnpm install

# fill .env with at least one provider key
echo "OPENAI_API_KEY=sk-..." >> .env

# idempotent setup (master key, migrations, tenant + API key)
pnpm bootstrap

# everything up — control-plane, runtime, dashboard, web
pnpm dev
```

In another terminal, exercise the platform:

```bash
RELAY_MODEL=gpt-4o-mini pnpm example
```

Open http://localhost:3000 to see the run.

## Where things live

- `packages/sdk/` — the public `@relayhq/sdk` (TS)
- `packages/control-plane/` — Hono / Node API on `:4000`
- `packages/db/` — Postgres schema, queries, encryption, migrations
- `runtime/` — stateless Go runtime on `:4100`
- `apps/dashboard/` — internal observability UI (`:3000`)
- `apps/web/` — marketing site / docs / login (`:3001`)
- `examples/` — runnable demos
- `migrations/*.sql` — applied in order by `pnpm db:migrate`

Architecture summary lives in the top-level [README](README.md).

## Making a change

1. **Branch off `main`** with a short kebab-case name (`fix-tool-timeout`,
   `add-cohere-provider`, …).
2. **Keep the SDK contract stable.** `createAgent({...}).run(...)` returns an
   `AsyncIterable<AgentEvent>` — additive changes only.
3. **Match the prevailing style.** Plain TypeScript / Go, no clever
   abstractions, no unnecessary deps. The codebase is intentionally small.
4. **Typecheck and build locally** before pushing:
   ```bash
   pnpm -r run typecheck
   cd runtime && go vet ./... && go build ./... && cd ..
   ```
5. **Open a PR** against `main`. Describe the change in 2–3 lines. Link an
   issue if there is one.

CI runs the same typecheck + Go build on every PR. Green CI is required to
merge.

## Code style

- **TypeScript**: strict mode, no `any` without a comment, prefer
  `unknown` for external boundaries. ESM only.
- **Go**: stdlib first. The runtime has *zero* third-party deps today —
  please keep it that way unless there's a strong reason.
- **Tests**: there isn't a test suite yet. If you're touching critical paths
  (auth, encryption, provider streaming, tool callback) please add a focused
  test next to your change.
- **Comments**: only when the *why* isn't obvious. Don't restate the code.

## Adding a provider

The cleanest contribution path. The interface to implement is
`providers.Provider` in [`runtime/internal/providers/provider.go`](runtime/internal/providers/provider.go).

1. Add `runtime/internal/providers/<name>.go` with a `New<Name>(apiKey, baseURL)`
   constructor and a `Stream(ctx, req)` method.
2. Map its wire format to the normalized `Message` / `ContentPart` / `StreamEvent`
   types — every other provider does this; copy the pattern from `openai.go`
   or `anthropic.go`.
3. Register it in [`runtime/internal/providers/router.go`](runtime/internal/providers/router.go)
   under a new model-prefix or explicit `name:` selector.
4. Add model strings to `packages/sdk/src/types.ts` for autocomplete (optional
   but nice).
5. Document it in [README.md](README.md#sdk-contract).

## Reporting bugs / requesting features

Use the issue templates on
[github.com/KevinCorrea5103/relay/issues/new/choose](https://github.com/KevinCorrea5103/relay/issues/new/choose).

For security issues, do **not** open a public issue — email the maintainers
(see [SECURITY.md](SECURITY.md) once we add it; for now,
KevinCorrea5103 on GitHub).

## License

By contributing, you agree that your contributions will be licensed under the
Apache License 2.0 (the project's license). No CLA required.
