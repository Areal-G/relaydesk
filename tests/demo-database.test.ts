import { asc } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_PASSWORD } from "@/lib/demo-accounts";
import { authenticate } from "@/server/auth/service";
import type { Database, DatabaseHandle } from "@/server/db/client";
import { createDemoDatabase } from "@/server/db/demo";
import { organizations, ticketComments, tickets, users } from "@/server/db/schema";

async function ids(db: Database) {
  return {
    organizations: await db.select({ id: organizations.id }).from(organizations).orderBy(asc(organizations.id)),
    users: await db.select({ id: users.id, email: users.email }).from(users).orderBy(asc(users.id)),
    tickets: await db.select({ id: tickets.id, number: tickets.number }).from(tickets).orderBy(asc(tickets.id)),
    comments: await db.select({ id: ticketComments.id }).from(ticketComments).orderBy(asc(ticketComments.id)),
  };
}

describe("demo database", () => {
  let first: DatabaseHandle;
  let second: DatabaseHandle;

  beforeAll(async () => {
    [first, second] = await Promise.all([createDemoDatabase(), createDemoDatabase()]);
  });

  afterAll(async () => {
    await Promise.all([first.close(), second.close()]);
  });

  it("gives every instance the same IDs, so sessions and links work on any of them", async () => {
    const a = await ids(first.db);
    expect(a.users.length).toBeGreaterThan(0);
    expect(a.tickets.length).toBeGreaterThan(0);
    expect(a.users[0]?.id).toMatch(/^00000000-0000-4000-8000-[0-9a-f]{12}$/);
    expect(await ids(second.db)).toEqual(a);
  });

  it("signs in the sample accounts with the public demo password", async () => {
    const actor = await authenticate(first.db, { email: "olivia@northwind.test", password: DEMO_PASSWORD });
    expect(actor.role).toBe("owner");
  });

  it("keeps generating unique IDs for rows created after seeding", async () => {
    const [org] = await first.db.insert(organizations).values({ name: "New", slug: "new-org" }).returning();
    expect(org?.id).toMatch(/^00000000-0000-4000-8000-/);
    expect((await ids(first.db)).organizations.map((o) => o.id)).toContain(org?.id);
  });
});
