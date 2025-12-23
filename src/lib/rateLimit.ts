import type { NextRequest } from "next/server";

type RateLimitResult =
  | {
      ok: true;
      limit: number;
      remaining: number;
      resetMs: number;
    }
  | {
      ok: false;
      limit: number;
      remaining: number;
      resetMs: number;
    };

type Options = {
  key: string;
  limit: number;
  windowMs: number;
};

const buckets = new Map<string, { resetMs: number; count: number }>();

export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

// Simple in-memory fixed-window limiter.
// NOTE: On serverless platforms this is best-effort; use Redis/Upstash for strict guarantees.
export function rateLimit({ key, limit, windowMs }: Options): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetMs <= now) {
    const resetMs = now + windowMs;
    buckets.set(key, { resetMs, count: 1 });
    return { ok: true, limit, remaining: limit - 1, resetMs };
  }

  if (bucket.count >= limit) {
    return { ok: false, limit, remaining: 0, resetMs: bucket.resetMs };
  }

  bucket.count += 1;
  buckets.set(key, bucket);
  return { ok: true, limit, remaining: limit - bucket.count, resetMs: bucket.resetMs };
}
