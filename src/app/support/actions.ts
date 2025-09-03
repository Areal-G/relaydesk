"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { portalReplySchema, portalTicketSchema } from "@/lib/validators/portal";
import { toActionError } from "@/server/actions";
import { getDb } from "@/server/db/client";
import { clientIp } from "@/server/http";
import { track } from "@/server/observability/metrics";
import { addCustomerReply, createCustomerTicket, getPortalOrg } from "@/server/portal/service";
import { rateLimiters } from "@/server/rate-limit";

async function enforcePortalLimit(key: string) {
  const ip = clientIp(await headers());
  if (ip) rateLimiters.portal.enforce(`portal-ip:${ip}`);
  rateLimiters.portal.enforce(key);
}

export async function submitPortalTicketAction(
  slug: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Honeypot: a field hidden from people that naive bots fill in.
  if (String(formData.get("website") ?? "") !== "") return { status: "success" };

  let token: string;
  try {
    const input = portalTicketSchema.parse(Object.fromEntries(formData));
    await enforcePortalLimit(`portal:${input.email}`);
    const db = await getDb();
    const org = await getPortalOrg(db, slug);
    const ticket = await createCustomerTicket(db, org.id, input, "portal");
    track.ticketCreated({ plan: org.plan, priority: "normal", channel: "portal" });
    token = ticket.token;
  } catch (error) {
    return toActionError(error);
  }
  redirect(`/support/ticket/${token}?new=1`);
}

export async function customerReplyAction(token: string, _previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { body } = portalReplySchema.parse({ body: formData.get("body") });
    await enforcePortalLimit(`portal-reply:${token}`);
    await addCustomerReply(await getDb(), token, body);
  } catch (error) {
    return toActionError(error);
  }
  revalidatePath(`/support/ticket/${token}`);
  return { status: "success", message: "Reply sent" };
}
