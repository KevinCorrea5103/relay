/**
 * Where the public Relay control plane lives. The signup form POSTs to this URL.
 *
 * Configure via NEXT_PUBLIC_RELAY_URL in the deployed env (Vercel project
 * settings). Falls back to localhost so the form still works for self-host
 * dev.
 */
export const RELAY_URL =
  process.env.NEXT_PUBLIC_RELAY_URL ?? "http://localhost:4000";
