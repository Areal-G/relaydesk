import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authenticate } from "@/server/auth/service";
import { registerOrganization, slugify } from "@/server/auth/signup";
import { memberships, ticketComments, tickets } from "@/server/db/schema";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/errors";
import { clientIp } from "@/server/http";
import {
  addCustomerReply,
  createCustomerTicket,
  getCustomerTicket,
  getPortalOrg,
  handleInboundEmail,
  issueCustomerLink,
  slugFromRecipient,
} from "@/server/portal/service";
import { addComment, listTickets } from "@/server/tickets/service";
import { createTestDb, type TestDb } from "./support/db";

let t: TestDb;

beforeAll(async () => {
  t = await createTestDb();
});

afterAll(() => t.handle.close());

describe("self-serve sign-up", () => {
  it("creates a Free organization with the new user as its owner", async () => {
    const actor = await registerOrganization(
      t.db,
      { name: "Sam Taylor", email: "sam@brightside.test", password: "correct-horse", orgName: "Brightside Studio" },
      { passwordRounds: 4 },
    );
    expect(actor).toMatchObject({ role: "owner", plan: "free", orgName: "Brightside Studio", orgSlug: "brightside-studio" });

    const signedIn = await authenticate(t.db, { email: "sam@brightside.test", password: "correct-horse" });
    expect(signedIn.orgId).toBe(actor.orgId);
  });

  it("rejects an email that already has an account", async () => {
    await expect(
      registerOrganization(
        t.db,
        { name: "Olivia", email: "olivia@northwind.test", password: "whatever-123", orgName: "Another" },
        { passwordRounds: 4 },
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("gives every organization a unique, URL-safe portal slug", async () => {
    expect(slugify("  Café Ünïcode & Co!! ")).toBe("cafe-unicode-co");
    const second = await registerOrganization(
      t.db,
      { name: "Lee", email: "lee@brightside.test", password: "correct-horse", orgName: "Brightside Studio" },
      { passwordRounds: 4 },
    );
    expect(second.orgSlug).toMatch(/^brightside-studio-[0-9a-f]{4}$/);
    const reserved = await registerOrganization(
      t.db,
      { name: "Tia", email: "tia@ticket.test", password: "correct-horse", orgName: "Ticket" },
      { passwordRounds: 4 },
    );
    expect(reserved.orgSlug).toBe("ticket-team");
  });
});

describe("customer support portal", () => {
  it("opens a ticket the team sees in its queue, linked to a private customer page", async () => {
    const org = await getPortalOrg(t.db, "northwind");
    const created = await createCustomerTicket(
      t.db,
      org.id,
      { name: "Nina Park", email: "nina@parkbakery.test", subject: "Menu page is blank", description: "Since this morning." },
      "portal",
    );
    expect(created.token).toMatch(/^[A-Za-z0-9_-]{32}$/);

    const agent = await t.actor(t.seed.northwind.users.aisha);
    const queue = await listTickets(t.db, agent, { q: "Menu page is blank", page: 1, pageSize: 20 });
    expect(queue.items).toHaveLength(1);
    expect(queue.items[0]).toMatchObject({ number: created.number, requesterEmail: "nina@parkbakery.test" });

    // Only the hash is stored.
    const [row] = await t.db.select().from(tickets).where(eq(tickets.id, created.id));
    expect(row?.customerTokenHash).not.toContain(created.token);
  });

  it("shows customers public replies only, never internal notes", async () => {
    const org = await getPortalOrg(t.db, "northwind");
    const { id, token } = await createCustomerTicket(
      t.db,
      org.id,
      { name: "Nina Park", email: "nina@parkbakery.test", subject: "Logo looks blurry", description: "On retina screens." },
      "portal",
    );
    const agent = await t.actor(t.seed.northwind.users.aisha);
    await addComment(t.db, agent, id, { body: "We're on it!", isInternal: false });
    await addComment(t.db, agent, id, { body: "Probably the 1x asset.", isInternal: true });

    const view = await getCustomerTicket(t.db, token);
    expect(view.replies.map((reply) => reply.body)).toEqual(["We're on it!"]);
    expect(view.ticket.orgName).toBe("Northwind Agency");
  });

  it("customer replies reopen the ticket", async () => {
    const org = await getPortalOrg(t.db, "northwind");
    const { id, token } = await createCustomerTicket(
      t.db,
      org.id,
      { name: "Nina Park", email: "nina@parkbakery.test", subject: "Footer link broken", description: "Contact link 404s." },
      "portal",
    );
    await t.db.update(tickets).set({ status: "resolved", resolvedAt: new Date() }).where(eq(tickets.id, id));

    await addCustomerReply(t.db, token, "Still broken on mobile.");
    const [row] = await t.db.select().from(tickets).where(eq(tickets.id, id));
    expect(row).toMatchObject({ status: "open", resolvedAt: null });
    const [comment] = await t.db.select().from(ticketComments).where(eq(ticketComments.ticketId, id));
    expect(comment).toMatchObject({ authorId: null, authorName: "Nina Park", isInternal: false });
  });

  it("rejects unknown or malformed links and unknown portals with 404", async () => {
    await expect(getCustomerTicket(t.db, "not-a-token")).rejects.toBeInstanceOf(NotFoundError);
    await expect(getCustomerTicket(t.db, "A".repeat(32))).rejects.toBeInstanceOf(NotFoundError);
    await expect(getPortalOrg(t.db, "no-such-agency")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lets agents issue a new link, which revokes the old one, but not viewers or other tenants", async () => {
    const org = await getPortalOrg(t.db, "northwind");
    const { id, token } = await createCustomerTicket(
      t.db,
      org.id,
      { name: "Nina Park", email: "nina@parkbakery.test", subject: "Lost my link", description: "Help." },
      "portal",
    );
    const agent = await t.actor(t.seed.northwind.users.aisha);
    const fresh = await issueCustomerLink(t.db, agent, id);
    await expect(getCustomerTicket(t.db, token)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getCustomerTicket(t.db, fresh)).resolves.toBeTruthy();

    const viewer = await t.actor(t.seed.northwind.users.victor);
    await expect(issueCustomerLink(t.db, viewer, id)).rejects.toBeInstanceOf(ForbiddenError);
    const globex = await t.actor(t.seed.globex.ownerId, t.seed.globex.orgId);
    await expect(issueCustomerLink(t.db, globex, id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("inbound email", () => {
  it("routes by recipient address, including plus-addressing", () => {
    expect(slugFromRecipient("northwind@help.relaydesk.test")).toBe("northwind");
    expect(slugFromRecipient("Support <support+globex@help.relaydesk.test>")).toBe("globex");
  });

  it("opens a ticket, then threads replies from the requester that reference it", async () => {
    const created = await handleInboundEmail(t.db, {
      to: "support+northwind@help.relaydesk.test",
      from: "omar@omarflorist.test",
      fromName: "Omar Haddad",
      subject: "Shop checkout times out",
      text: "Customers can't pay.",
    });
    expect(created.action).toBe("created");

    const reply = await handleInboundEmail(t.db, {
      to: "support+northwind@help.relaydesk.test",
      from: "omar@omarflorist.test",
      subject: `Re: [#${created.number}] Shop checkout times out`,
      text: "Any update?",
    });
    expect(reply).toMatchObject({ action: "reply", ticketId: created.ticketId });
  });

  it("never lets another sender append to a ticket by quoting its number", async () => {
    const original = await handleInboundEmail(t.db, {
      to: "northwind@help.relaydesk.test",
      from: "omar@omarflorist.test",
      subject: "Domain renewal",
      text: "When does it renew?",
    });
    const forged = await handleInboundEmail(t.db, {
      to: "northwind@help.relaydesk.test",
      from: "mallory@evil.test",
      subject: `[#${original.number}] hijack`,
      text: "Injected text",
    });
    expect(forged.action).toBe("created");
    expect(forged.ticketId).not.toBe(original.ticketId);
    const comments = await t.db
      .select()
      .from(ticketComments)
      .where(and(eq(ticketComments.ticketId, original.ticketId), eq(ticketComments.body, "Injected text")));
    expect(comments).toHaveLength(0);
  });
});

describe("client IP resolution", () => {
  const forwarded = new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" });

  it("ignores forwarding headers unless proxies are trusted", () => {
    expect(clientIp(forwarded, 0)).toBeNull();
  });

  it("takes the address appended by the trusted proxy, not the spoofable leftmost one", () => {
    expect(clientIp(forwarded, 1)).toBe("203.0.113.9");
    expect(clientIp(forwarded, 2)).toBe("6.6.6.6");
  });
});

it("keeps sign-up owners as the only members of their new organization", async () => {
  const actor = await registerOrganization(
    t.db,
    { name: "Ana", email: "ana@solo.test", password: "correct-horse", orgName: "Solo Studio" },
    { passwordRounds: 4 },
  );
  const rows = await t.db.select().from(memberships).where(eq(memberships.orgId, actor.orgId));
  expect(rows).toEqual([expect.objectContaining({ userId: actor.userId, role: "owner" })]);
});
