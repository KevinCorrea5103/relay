import type { MiddlewareHandler } from "hono";
import type { AuthVars } from "./auth.js";

// ─── Rate limiting ─────────────────────────────────────────────────────────
//
// Token bucket per tenant + endpoint class. Two backends:
//
//   MemoryBackend — default. Process-local. Good for dev and any
//     single-instance deployment. Each control-plane replica enforces its
//     own limits independently, so an N-instance fleet gives effective
//     `limit * N` throughput. Acceptable for the initial rollout.
//
//   RedisBackend  — activated by REDIS_URL. Uses an atomic Lua script so
//     the bucket is consistent across replicas. Required once the control
//     plane scales horizontally and we want enforced caps regardless of
//     which instance a request lands on.
//
// Buckets keyed by (tenantId, endpointClass). Two classes:
//   - "default"  — most read endpoints, generous limit
//   - "runs"     — POST /v1/runs, expensive, tighter limit
//
// On limit exceeded we return HTTP 429 with `Retry-After` (seconds) and
// `RateLimit-*` informational headers.

export type RateLimitClass = "default" | "runs";

export type Quota = {
  capacity: number; // bucket size
  refillPerSec: number; // tokens added per second
};

export const DEFAULT_QUOTAS: Record<RateLimitClass, Quota> = {
  default: { capacity: 60, refillPerSec: 60 / 60 }, // 60 req/min
  runs: { capacity: 30, refillPerSec: 30 / 60 }, // 30 runs/min
};

export type RateLimitDecision = {
  allowed: boolean;
  remaining: number; // tokens left after the attempt
  retryAfterMs: number; // 0 when allowed
  resetMs: number; // ms until bucket fully refilled
};

export interface RateLimitBackend {
  take(key: string, quota: Quota, cost: number): Promise<RateLimitDecision>;
  kind: "memory" | "redis";
}

// ─── In-memory backend ─────────────────────────────────────────────────────

class MemoryBackend implements RateLimitBackend {
  kind = "memory" as const;
  private buckets = new Map<string, { tokens: number; updatedAt: number }>();

  async take(key: string, quota: Quota, cost: number): Promise<RateLimitDecision> {
    const now = Date.now();
    const b = this.buckets.get(key) ?? {
      tokens: quota.capacity,
      updatedAt: now,
    };
    // Refill since last touch.
    const elapsedSec = (now - b.updatedAt) / 1000;
    const refilled = Math.min(
      quota.capacity,
      b.tokens + elapsedSec * quota.refillPerSec,
    );
    if (refilled < cost) {
      const deficit = cost - refilled;
      const retryAfterMs = Math.ceil((deficit / quota.refillPerSec) * 1000);
      this.buckets.set(key, { tokens: refilled, updatedAt: now });
      return {
        allowed: false,
        remaining: Math.floor(refilled),
        retryAfterMs,
        resetMs: Math.ceil(
          ((quota.capacity - refilled) / quota.refillPerSec) * 1000,
        ),
      };
    }
    const next = refilled - cost;
    this.buckets.set(key, { tokens: next, updatedAt: now });
    return {
      allowed: true,
      remaining: Math.floor(next),
      retryAfterMs: 0,
      resetMs: Math.ceil(((quota.capacity - next) / quota.refillPerSec) * 1000),
    };
  }
}

// ─── Redis backend (atomic via Lua) ────────────────────────────────────────
//
// Lazily imports `ioredis` so that the package is only required when
// REDIS_URL is set. This keeps the default install lean.

class RedisBackend implements RateLimitBackend {
  kind = "redis" as const;
  private redis: any;
  private static SCRIPT = `
    -- KEYS[1] bucket key
    -- ARGV[1] capacity
    -- ARGV[2] refillPerSec
    -- ARGV[3] now (ms)
    -- ARGV[4] cost
    local cap = tonumber(ARGV[1])
    local rate = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    local cost = tonumber(ARGV[4])
    local state = redis.call('HMGET', KEYS[1], 'tokens', 'updated_at')
    local tokens = tonumber(state[1])
    local updated = tonumber(state[2])
    if not tokens then
      tokens = cap
      updated = now
    end
    local elapsed = math.max(0, (now - updated) / 1000)
    tokens = math.min(cap, tokens + elapsed * rate)
    local allowed = 0
    local retry = 0
    if tokens >= cost then
      tokens = tokens - cost
      allowed = 1
    else
      local deficit = cost - tokens
      retry = math.ceil((deficit / rate) * 1000)
    end
    redis.call('HMSET', KEYS[1], 'tokens', tokens, 'updated_at', now)
    -- TTL = time to refill from empty + slop
    redis.call('PEXPIRE', KEYS[1], math.ceil((cap / rate) * 1000) + 5000)
    local reset = math.ceil(((cap - tokens) / rate) * 1000)
    return { allowed, math.floor(tokens), retry, reset }
  `;

  constructor(redis: any) {
    this.redis = redis;
  }

  static async connect(redisUrl: string): Promise<RedisBackend> {
    const { default: Redis } = await import("ioredis");
    const redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      lazyConnect: false,
    });
    return new RedisBackend(redis);
  }

  async take(key: string, quota: Quota, cost: number): Promise<RateLimitDecision> {
    const res = (await this.redis.eval(
      RedisBackend.SCRIPT,
      1,
      key,
      quota.capacity,
      quota.refillPerSec,
      Date.now(),
      cost,
    )) as [number, number, number, number];
    return {
      allowed: res[0] === 1,
      remaining: res[1],
      retryAfterMs: res[2],
      resetMs: res[3],
    };
  }
}

// ─── Public singleton + bootstrap ──────────────────────────────────────────

let backend: RateLimitBackend = new MemoryBackend();

export async function initRateLimit(): Promise<{ kind: "memory" | "redis" }> {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    return { kind: "memory" };
  }
  try {
    backend = await RedisBackend.connect(redisUrl);
    return { kind: "redis" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[rate-limit] REDIS_URL set but connection failed: ${message}. ` +
        `Falling back to in-memory backend.`,
    );
    return { kind: "memory" };
  }
}

// Middleware factory. Pass the class to enforce different quotas per route.
export function rateLimit(
  cls: RateLimitClass = "default",
  cost = 1,
): MiddlewareHandler<{ Variables: AuthVars }> {
  return async (c, next) => {
    const tenantId = c.get("tenantId");
    if (!tenantId) {
      // Not authenticated yet — let auth handle it.
      await next();
      return;
    }
    const quota =
      DEFAULT_QUOTAS[cls] ?? DEFAULT_QUOTAS.default;
    const key = `rl:${tenantId}:${cls}`;
    const decision = await backend.take(key, quota, cost);

    c.header("RateLimit-Limit", String(quota.capacity));
    c.header("RateLimit-Remaining", String(decision.remaining));
    c.header("RateLimit-Reset", String(Math.ceil(decision.resetMs / 1000)));

    if (!decision.allowed) {
      const retrySec = Math.max(1, Math.ceil(decision.retryAfterMs / 1000));
      c.header("Retry-After", String(retrySec));
      return c.json(
        {
          error: "rate limit exceeded",
          retryAfterSeconds: retrySec,
          class: cls,
        },
        429,
      );
    }
    await next();
  };
}

export const __TESTING__ = { MemoryBackend, RedisBackend };
