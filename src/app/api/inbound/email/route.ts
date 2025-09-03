import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { inboundEmailSchema } from "@/lib/validators/portal";
import { getDb } from "@/server/db/client";
import { UnauthorizedError } from "@/server/errors";
import { parseJson, withApi } from "@/server/http";
import { handleInboundEmail } from "@/server/portal/service";

function hasValidSecret(request: Request, secret: string): boolean {
  const supplied = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1] ?? "";
  const a = Buffer.from(supplied);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * POST /api/inbound/email  { to, from, fromName?, subject, text }
 * Called by your email provider's inbound webhook (authenticated with
 * `Authorization: Bearer $INBOUND_EMAIL_SECRET`). Mail to `<slug>@…` or
 * `support+<slug>@…` opens a ticket; replies with "[#1042]" in the subject
 * from the original requester are added to that ticket.
 */
export const POST = withApi("inbound.email", async (request) => {
  const secret = process.env.INBOUND_EMAIL_SECRET;
  if (!secret || secret.length < 16) {
    return NextResponse.json(
      { error: { code: "not_configured", message: "Inbound email is not configured" } },
      { status: 503 },
    );
  }
  if (!hasValidSecret(request, secret)) throw new UnauthorizedError("Invalid inbound email secret");

  const input = await parseJson(request, inboundEmailSchema);
  const result = await handleInboundEmail(await getDb(), input);
  return NextResponse.json(result, { status: result.action === "created" ? 201 : 200 });
});
