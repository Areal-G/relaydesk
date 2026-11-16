import { sql } from "drizzle-orm";
import type { Plan, Role } from "@/lib/domain";
import { hashPassword } from "@/server/auth/password";
import type { Database } from "./client";
import { aiUsage, auditLogs, memberships, organizations, ticketComments, tickets, users } from "./schema";
import { DEFAULT_SEED_PASSWORD, SAMPLE_ACCOUNTS, SAMPLE_ORG, SECOND_ORG_ACCOUNT, SECOND_SAMPLE_ORG } from "./seed-accounts";
import { GLOBEX_TICKETS, NORTHWIND_TICKETS, type SeedTicket, type StaffKey } from "./seed-data";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export interface SeedResult {
  northwind: { orgId: string; users: Record<StaffKey | "victor", string> };
  globex: { orgId: string; ownerId: string };
}

export interface SeedOptions {
  now?: Date;
  passwordRounds?: number;
  /** Password for every sample account (default DEFAULT_SEED_PASSWORD). */
  password?: string;
  /** Replaces the Northwind owner's email and name, so you sign in with your own address. */
  owner?: { email?: string; name?: string };
}

/**
 * Resets and loads deterministic sample data: two organizations (to show tenant
 * isolation), a user for every role, and a realistic support queue.
 */
export async function seedSampleData(db: Database, options: SeedOptions = {}): Promise<SeedResult> {
  const now = options.now ?? new Date();
  const passwordHash = await hashPassword(options.password ?? DEFAULT_SEED_PASSWORD, options.passwordRounds);
  const accounts = SAMPLE_ACCOUNTS.map((account) =>
    account.role === "owner"
      ? { ...account, email: options.owner?.email ?? account.email, name: options.owner?.name ?? account.name }
      : account,
  );

  return db.transaction(async (tx) => {
    await tx.execute(sql`truncate table organizations, users, stripe_events restart identity cascade`);

    const [northwind] = await tx
      .insert(organizations)
      .values({
        name: SAMPLE_ORG.name,
        slug: SAMPLE_ORG.slug,
        plan: "pro" satisfies Plan,
        subscriptionStatus: "active",
        currentPeriodEnd: new Date(now.getTime() + 18 * DAY),
        createdAt: new Date(now.getTime() - 90 * DAY),
      })
      .returning();
    const [globex] = await tx
      .insert(organizations)
      .values({ name: SECOND_SAMPLE_ORG.name, slug: SECOND_SAMPLE_ORG.slug, plan: "free" })
      .returning();
    if (!northwind || !globex) throw new Error("Failed to create organizations");

    const insertedUsers = await tx
      .insert(users)
      .values([...accounts, SECOND_ORG_ACCOUNT].map(({ email, name }) => ({ email, name, passwordHash })))
      .returning({ id: users.id, email: users.email });
    const idByEmail = new Map(insertedUsers.map((u) => [u.email, u.id]));
    const userId = (email: string) => {
      const id = idByEmail.get(email);
      if (!id) throw new Error(`Seed user missing: ${email}`);
      return id;
    };

    await tx.insert(memberships).values([
      ...accounts.map((account, index) => ({
        orgId: northwind.id,
        userId: userId(account.email),
        role: account.role,
        createdAt: new Date(now.getTime() - (90 - index) * DAY),
      })),
      { orgId: globex.id, userId: userId(SECOND_ORG_ACCOUNT.email), role: SECOND_ORG_ACCOUNT.role as Role },
    ]);

    const byKey = Object.fromEntries(accounts.map((account) => [account.key, account])) as Record<
      StaffKey | "victor",
      (typeof accounts)[number]
    >;
    const staff = Object.fromEntries(
      Object.entries(byKey).map(([key, account]) => [key, userId(account.email)]),
    ) as Record<StaffKey | "victor", string>;

    async function insertQueue(orgId: string, queue: SeedTicket[], fallbackCreator: string, assignees: boolean) {
      // Oldest first so ticket numbers increase with creation time.
      const ordered = [...queue].sort((a, b) => b.daysAgo - a.daysAgo);
      for (const [index, seed] of ordered.entries()) {
        const createdAt = new Date(now.getTime() - seed.daysAgo * DAY - ((index * 7) % 9) * HOUR - HOUR);
        const lastMessageAt = seed.thread.at(-1)?.hoursAfter ?? 0;
        const updatedAt = new Date(Math.min(now.getTime(), createdAt.getTime() + lastMessageAt * HOUR));
        const closed = seed.status === "resolved" || seed.status === "closed";
        const assigneeId = assignees && seed.assignee ? staff[seed.assignee] : null;

        const [ticket] = await tx
          .insert(tickets)
          .values({
            orgId,
            number: 1001 + index,
            subject: seed.subject,
            description: seed.description,
            status: seed.status,
            priority: seed.priority,
            requesterName: seed.requester[0],
            requesterEmail: seed.requester[1],
            assigneeId,
            createdById: fallbackCreator,
            createdAt,
            updatedAt,
            resolvedAt: closed ? updatedAt : null,
          })
          .returning({ id: tickets.id });
        if (!ticket) throw new Error("Failed to create ticket");

        await tx.insert(auditLogs).values({
          orgId,
          actorId: fallbackCreator,
          action: "ticket.created",
          entityType: "ticket",
          entityId: ticket.id,
          metadata: { number: 1001 + index, priority: seed.priority },
          createdAt,
        });
        if (assigneeId) {
          await tx.insert(auditLogs).values({
            orgId,
            actorId: fallbackCreator,
            action: "ticket.updated",
            entityType: "ticket",
            entityId: ticket.id,
            metadata: { changes: { assigneeId: { from: null, to: assigneeId } } },
            createdAt: new Date(createdAt.getTime() + 0.1 * HOUR),
          });
        }

        for (const message of seed.thread) {
          const at = new Date(Math.min(now.getTime(), createdAt.getTime() + message.hoursAfter * HOUR));
          const fromStaff = message.from !== "customer";
          await tx.insert(ticketComments).values({
            orgId,
            ticketId: ticket.id,
            authorId: fromStaff ? staff[message.from as StaffKey] : null,
            authorName: fromStaff ? byKey[message.from as StaffKey].name : seed.requester[0],
            body: message.body,
            isInternal: message.internal ?? false,
            createdAt: at,
          });
          if (fromStaff) {
            await tx.insert(auditLogs).values({
              orgId,
              actorId: staff[message.from as StaffKey],
              action: message.internal ? "comment.internal_note" : "comment.created",
              entityType: "ticket",
              entityId: ticket.id,
              createdAt: at,
            });
          }
        }

        if (seed.status !== "open") {
          await tx.insert(auditLogs).values({
            orgId,
            actorId: assigneeId ?? fallbackCreator,
            action: "ticket.updated",
            entityType: "ticket",
            entityId: ticket.id,
            metadata: { changes: { status: { from: "open", to: seed.status } } },
            createdAt: updatedAt,
          });
        }
      }
    }

    await insertQueue(northwind.id, NORTHWIND_TICKETS, staff.adam, true);
    await insertQueue(globex.id, GLOBEX_TICKETS, userId(SECOND_ORG_ACCOUNT.email), false);

    // Some AI assist history this month, so quotas and the billing page have data.
    const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    const span = Math.max(1, now.getTime() - monthStart);
    const agents = [staff.aisha, staff.marco, staff.adam];
    await tx.insert(aiUsage).values(
      Array.from({ length: 37 }, (_, i) => ({
        orgId: northwind.id,
        userId: agents[i % agents.length],
        task: i % 3 === 0 ? ("reply" as const) : ("summary" as const),
        provider: "mock",
        model: "relaydesk-mock-1",
        inputTokens: 900 + ((i * 137) % 600),
        outputTokens: 140 + ((i * 53) % 120),
        latencyMs: 700 + ((i * 211) % 1400),
        createdAt: new Date(monthStart + ((i + 0.5) / 37) * span),
      })),
    );

    return {
      northwind: { orgId: northwind.id, users: staff },
      globex: { orgId: globex.id, ownerId: userId(SECOND_ORG_ACCOUNT.email) },
    };
  });
}

