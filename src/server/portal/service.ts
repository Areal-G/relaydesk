import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import type { InboundEmailInput, PortalTicketInput } from "@/lib/validators/portal";
import { recordAudit } from "@/server/audit";
import type { Actor } from "@/server/auth/actor";
import type { DbExecutor } from "@/server/db/client";
import { organizations, ticketComments, tickets } from "@/server/db/schema";
import { NotFoundError } from "@/server/errors";
import { track } from "@/server/observability/metrics";
import { requirePermission } from "@/server/rbac";
import { getTicket, nextTicketNumber } from "@/server/tickets/service";

/*
 * Customer-facing side of the help desk. Customers have no accounts: each
 * ticket gets a private link holding a random secret, and only its SHA-256
 * hash is stored. Customers only ever see public replies, never internal notes.
 */

export type CustomerChannel = "portal" | "email";

function newCustomerToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashToken(token) };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Tokens are 32 base64url characters; anything else can't match and skips the lookup. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

export async function getPortalOrg(db: DbExecutor, slug: string) {
  const [org] = await db
    .select({ id: organizations.id, name: organizations.name, slug: organizations.slug, plan: organizations.plan })
    .from(organizations)
    .where(eq(organizations.slug, slug.toLowerCase()));
  if (!org) throw new NotFoundError("Support portal not found");
  return org;
}

/** Opens a ticket on behalf of a customer and returns the secret for their private link. */
export async function createCustomerTicket(
  db: DbExecutor,
  orgId: string,
  input: PortalTicketInput,
  channel: CustomerChannel,
) {
  const { token, hash } = newCustomerToken();
  const ticket = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(tickets)
      .values({
        orgId,
        number: await nextTicketNumber(tx, orgId),
        subject: input.subject,
        description: input.description,
        requesterName: input.name,
        requesterEmail: input.email,
        customerTokenHash: hash,
      })
      .returning({ id: tickets.id, number: tickets.number });
    if (!created) throw new Error("Ticket insert returned no row");
    await recordAudit(tx, { orgId, userId: null }, {
      action: "ticket.customer_created",
      entityType: "ticket",
      entityId: created.id,
      metadata: { number: created.number, channel, customerName: input.name },
    });
    return created;
  });
  return { ...ticket, token };
}

async function findTicketByToken(db: DbExecutor, token: string) {
  if (!TOKEN_PATTERN.test(token)) throw new NotFoundError("Ticket not found");
  const [ticket] = await db
    .select({
      id: tickets.id,
      orgId: tickets.orgId,
      orgName: organizations.name,
      orgSlug: organizations.slug,
      number: tickets.number,
      subject: tickets.subject,
      description: tickets.description,
      status: tickets.status,
      requesterName: tickets.requesterName,
      createdAt: tickets.createdAt,
    })
    .from(tickets)
    .innerJoin(organizations, eq(organizations.id, tickets.orgId))
    .where(eq(tickets.customerTokenHash, hashToken(token)));
  if (!ticket) throw new NotFoundError("Ticket not found");
  return ticket;
}

/** The ticket as the customer sees it: public replies only, staff shown by name. */
export async function getCustomerTicket(db: DbExecutor, token: string) {
  const ticket = await findTicketByToken(db, token);
  const replies = await db
    .select({
      id: ticketComments.id,
      authorName: ticketComments.authorName,
      authorId: ticketComments.authorId,
      body: ticketComments.body,
      createdAt: ticketComments.createdAt,
    })
    .from(ticketComments)
    .where(
      and(
        eq(ticketComments.ticketId, ticket.id),
        eq(ticketComments.orgId, ticket.orgId),
        eq(ticketComments.isInternal, false),
      ),
    )
    .orderBy(asc(ticketComments.createdAt));
  return {
    ticket,
    replies: replies.map(({ authorId, ...reply }) => ({ ...reply, fromCustomer: authorId === null })),
  };
}

export type CustomerTicketView = Awaited<ReturnType<typeof getCustomerTicket>>;

async function insertCustomerReply(
  db: DbExecutor,
  ticket: { id: string; orgId: string; requesterName: string },
  body: string,
  channel: CustomerChannel,
) {
  await db.transaction(async (tx) => {
    const [comment] = await tx
      .insert(ticketComments)
      .values({ orgId: ticket.orgId, ticketId: ticket.id, authorId: null, authorName: ticket.requesterName, body })
      .returning({ id: ticketComments.id });
    // A customer reply puts the ticket back in the team's queue.
    await tx
      .update(tickets)
      .set({ status: "open", resolvedAt: null, updatedAt: new Date() })
      .where(and(eq(tickets.id, ticket.id), eq(tickets.orgId, ticket.orgId)));
    await recordAudit(tx, { orgId: ticket.orgId, userId: null }, {
      action: "comment.customer_reply",
      entityType: "ticket",
      entityId: ticket.id,
      metadata: { commentId: comment?.id, channel, customerName: ticket.requesterName },
    });
  });
}

export async function addCustomerReply(db: DbExecutor, token: string, body: string) {
  const ticket = await findTicketByToken(db, token);
  await insertCustomerReply(db, ticket, body, "portal");
  return ticket;
}

/**
 * Issues a fresh private link for a ticket (for example a ticket created by
 * staff, or when the customer lost theirs). Any previous link stops working.
 */
export async function issueCustomerLink(db: DbExecutor, actor: Actor, ticketId: string): Promise<string> {
  requirePermission(actor, "ticket:update");
  await getTicket(db, actor, ticketId); // 404s across tenants
  const { token, hash } = newCustomerToken();
  await db.transaction(async (tx) => {
    await tx
      .update(tickets)
      .set({ customerTokenHash: hash })
      .where(and(eq(tickets.id, ticketId), eq(tickets.orgId, actor.orgId)));
    await recordAudit(tx, actor, { action: "ticket.customer_link_issued", entityType: "ticket", entityId: ticketId });
  });
  return token;
}

/**
 * Resolves the organization an inbound email is addressed to. Accepts
 * `<slug>@your-domain` or plus-addressing like `support+<slug>@your-domain`.
 */
export function slugFromRecipient(to: string): string | null {
  const address = /<([^>]+)>/.exec(to)?.[1] ?? to;
  const local = address.split("@")[0]?.trim().toLowerCase();
  if (!local) return null;
  const plus = local.indexOf("+");
  return plus >= 0 ? local.slice(plus + 1) || null : local;
}

/**
 * Turns an inbound email into a ticket, or into a reply when the subject
 * carries a ticket reference like "[#1042]" and the sender is that ticket's
 * requester. Anything else opens a new ticket, so a forged reference can
 * never add text to someone else's conversation.
 */
export async function handleInboundEmail(db: DbExecutor, input: InboundEmailInput) {
  const slug = slugFromRecipient(input.to);
  if (!slug) throw new NotFoundError("Unknown recipient");
  const org = await getPortalOrg(db, slug);

  const reference = /\[#(\d{1,9})\]/.exec(input.subject)?.[1];
  if (reference) {
    const [existing] = await db
      .select({ id: tickets.id, orgId: tickets.orgId, requesterName: tickets.requesterName, number: tickets.number })
      .from(tickets)
      .where(
        and(eq(tickets.orgId, org.id), eq(tickets.number, Number(reference)), eq(tickets.requesterEmail, input.from)),
      );
    if (existing) {
      await insertCustomerReply(db, existing, input.text, "email");
      return { action: "reply" as const, ticketId: existing.id, number: existing.number };
    }
  }

  const subject = input.subject.replace(/\[#\d+\]\s*/g, "").trim();
  const created = await createCustomerTicket(
    db,
    org.id,
    {
      name: input.fromName || input.from.split("@")[0] || input.from,
      email: input.from,
      subject: subject.length >= 3 ? subject : "(no subject)",
      description: input.text,
    },
    "email",
  );
  track.ticketCreated({ plan: org.plan, priority: "normal", channel: "email" });
  return { action: "created" as const, ticketId: created.id, number: created.number, token: created.token };
}
