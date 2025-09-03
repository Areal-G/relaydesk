import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { formatIssues, uuidSchema } from "@/lib/validators/common";
import { AppError, NotFoundError, RateLimitError, ValidationError } from "@/server/errors";
import { logger } from "@/server/observability/logger";
import { track } from "@/server/observability/metrics";

export interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

/** Maps any thrown value to a JSON error response without leaking internals. */
export function errorResponse(error: unknown): NextResponse<ErrorBody> {
  if (error instanceof z.ZodError) {
    return errorResponse(new ValidationError("Validation failed", formatIssues(error)));
  }
  if (error instanceof AppError) {
    const response = NextResponse.json<ErrorBody>(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
    if (error instanceof RateLimitError) {
      response.headers.set("Retry-After", String(error.retryAfterSeconds));
    }
    return response;
  }
  return NextResponse.json<ErrorBody>(
    { error: { code: "internal_error", message: "Something went wrong" } },
    { status: 500 },
  );
}

/** Parses and validates a JSON request body. */
export async function parseJson<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
  return schema.parse(body);
}

/**
 * The caller's IP, or null when it can't be trusted. Forwarding headers are
 * client-controlled unless a proxy we run rewrites them, so they are only read
 * when TRUSTED_PROXY_HOPS says how many proxies sit in front of the app. The
 * address is then taken that many entries from the right of X-Forwarded-For
 * (proxies append), never from the client-supplied leftmost entry.
 */
export function clientIp(headers: Headers, trustedHops = trustedProxyHops()): string | null {
  if (trustedHops <= 0) return null;
  const chain = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (chain.length >= trustedHops) return chain[chain.length - trustedHops] ?? null;
  return headers.get("x-real-ip")?.trim() || null;
}

function trustedProxyHops(): number {
  const hops = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "0", 10);
  return Number.isFinite(hops) && hops > 0 ? hops : 0;
}

type RouteHandler<C> = (request: NextRequest, context: C) => Promise<Response>;

/**
 * Wraps a route handler with uniform error mapping, a structured access log
 * line and request metrics. `name` identifies the route in logs and metrics.
 */
export function withApi<C>(name: string, handler: RouteHandler<C>): RouteHandler<C> {
  return async (request, context) => {
    const started = performance.now();
    let response: Response;
    try {
      response = await handler(request, context);
    } catch (error) {
      response = errorResponse(error);
      if (response.status >= 500) logger.error({ err: error, route: name }, "Unhandled API error");
    }
    const durationMs = Math.round(performance.now() - started);
    track.apiRequest(durationMs, { route: name, method: request.method, status: response.status });
    logger.info(
      {
        route: name,
        duration_ms: durationMs,
        http: { method: request.method, status_code: response.status, url_details: { path: request.nextUrl.pathname } },
      },
      `${request.method} ${request.nextUrl.pathname} ${response.status}`,
    );
    return response;
  };
}

/** Route params arrive as strings; anything that isn't a UUID is simply "not found". */
export function parseId(id: string): string {
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) throw new NotFoundError();
  return parsed.data;
}
