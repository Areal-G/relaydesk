import { RateLimitError } from "@/server/errors";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Fixed-window, in-memory rate limiter keyed per user / IP. Good enough for a
 * single instance; a multi-instance deployment would back this with Redis
 * (same interface, INCR + EXPIRE).
 */
export class RateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly options: { limit: number; windowMs: number; now?: () => number },
  ) {}

  check(key: string): RateLimitResult {
    const now = this.options.now?.() ?? Date.now();
    let window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + this.options.windowMs };
      this.windows.set(key, window);
      this.sweep(now);
    }
    window.count += 1;
    const allowed = window.count <= this.options.limit;
    return { allowed, remaining: Math.max(0, this.options.limit - window.count), resetAt: window.resetAt };
  }

  /** Throws a RateLimitError (HTTP 429) when the key is over its limit. */
  enforce(key: string): RateLimitResult {
    const result = this.check(key);
    if (!result.allowed) {
      const now = this.options.now?.() ?? Date.now();
      throw new RateLimitError(Math.max(1, Math.ceil((result.resetAt - now) / 1000)));
    }
    return result;
  }

  reset(): void {
    this.windows.clear();
  }

  private sweep(now: number) {
    if (this.windows.size < 10_000) return;
    for (const [key, window] of this.windows) if (window.resetAt <= now) this.windows.delete(key);
  }
}

interface Limiters {
  login: RateLimiter;
  loginIp: RateLimiter;
  signup: RateLimiter;
  portal: RateLimiter;
  ai: RateLimiter;
}

const globalForLimits = globalThis as typeof globalThis & { __relaydeskLimiters?: Limiters };

/** Shared limiters (kept on globalThis so dev hot reloads don't reset them). */
export const rateLimiters = (globalForLimits.__relaydeskLimiters ??= {
  /** Per account, whatever the IP: 10 attempts per 15 minutes. */
  login: new RateLimiter({ limit: 10, windowMs: 15 * 60_000 }),
  /** Per trusted client IP across all accounts: 50 attempts per 15 minutes. */
  loginIp: new RateLimiter({ limit: 50, windowMs: 15 * 60_000 }),
  /** New workspaces: 5 per hour per trusted IP, and per email address. */
  signup: new RateLimiter({ limit: 5, windowMs: 60 * 60_000 }),
  /** Public support portal submissions and replies: 10 per 10 minutes per key. */
  portal: new RateLimiter({ limit: 10, windowMs: 10 * 60_000 }),
  /** Per user: 10 AI generations per minute (the monthly plan quota is separate). */
  ai: new RateLimiter({ limit: 10, windowMs: 60_000 }),
});

/**
 * Login throttling. The account limit can't be dodged by rotating IPs or
 * spoofed headers; the IP limit (only when the IP is trustworthy) slows one
 * client spraying many accounts.
 */
export function enforceLoginLimits(email: string, ip: string | null): void {
  if (ip) rateLimiters.loginIp.enforce(`login-ip:${ip}`);
  rateLimiters.login.enforce(`login:${email}`);
}

export function resetRateLimiters(): void {
  for (const limiter of Object.values(rateLimiters)) limiter.reset();
}
