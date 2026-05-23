import type { MiddlewareHandler } from "hono";
import { authenticateApiKey } from "@relayhq/db";

export type AuthVars = {
  tenantId: string;
  keyId: string;
};

export const requireAuth: MiddlewareHandler<{ Variables: AuthVars }> = async (
  c,
  next,
) => {
  const header = c.req.header("authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    return c.json({ error: "missing bearer token" }, 401);
  }
  const secret = header.slice(7).trim();
  const session = await authenticateApiKey(secret);
  if (!session) {
    return c.json({ error: "invalid api key" }, 401);
  }
  c.set("tenantId", session.tenantId);
  c.set("keyId", session.keyId);
  await next();
};
