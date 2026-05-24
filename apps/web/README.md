# @relayhq/web — landing + docs

Marketing site for Relay. Next.js 15, Tailwind, Geist, Shiki, Motion.

## Local dev

```bash
pnpm install
pnpm dev:web
# open http://localhost:3001
```

## Deploy to Vercel

Free subdomain (`*.vercel.app`). Custom domain optional later.

### One-time setup

```bash
cd apps/web
npx vercel login           # browser flow
npx vercel link            # links this directory to a new project
#   ? Set up "apps/web"?              Yes
#   ? Which scope?                    your-username
#   ? Link to existing project?       No
#   ? What's your project's name?     relay
#   ? In which directory is your code located? ./
```

The `vercel.json` in this directory tells Vercel:

- install deps from the workspace root (`cd ../..`)
- build via the workspace filter (`pnpm --filter @relayhq/web build`)
- serve `.next/` (relative to `apps/web`)

### Deploy

```bash
cd apps/web
npx vercel              # preview deploy
npx vercel --prod       # production deploy
```

You'll get a URL like `https://relay-<hash>-your-username.vercel.app`.

### Custom domain

```bash
npx vercel domains add relay.dev
# follow the DNS instructions Vercel prints
```

## Environment variables

| name                          | purpose                                                  |
|-------------------------------|----------------------------------------------------------|
| `NEXT_PUBLIC_TALLY_FORM_ID`   | Tally form ID for the waitlist (CTA section). See below. |
| `NEXT_PUBLIC_DASHBOARD_URL`   | Where the "Continue to dashboard" button on /login goes. |

Set them in the Vercel project settings → Environment Variables, then redeploy.

## Wiring the waitlist

The CTA section uses a `<Waitlist>` component that POSTs the email to a Tally
form. To wire it up:

1. Go to https://tally.so and create a free account
2. New form → add a single "email" field → publish
3. From the form URL `https://tally.so/r/<ID>`, copy `<ID>`
4. Set `NEXT_PUBLIC_TALLY_FORM_ID=<ID>` in Vercel env vars
5. Redeploy

Without it, the form falls back to a `mailto:` link.

## i18n

- Default: English at `/en/...`
- Spanish at `/es/...`
- Root `/` redirects to `/en`

Add a new locale: edit `lib/dict.ts` (add to `locales` and write a new dict).
