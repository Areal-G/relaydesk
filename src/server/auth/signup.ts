import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { SignupInput } from "@/lib/validators/auth";
import { recordAudit } from "@/server/audit";
import type { DbExecutor } from "@/server/db/client";
import { memberships, organizations, users } from "@/server/db/schema";
import { ConflictError } from "@/server/errors";
import { type Actor, loadActor } from "./actor";
import { hashPassword } from "./password";

/** URL-safe slug for the organization's public support portal (/support/<slug>). */
export function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return slug || "workspace";
}

/** Slugs that would collide with fixed routes under /support. */
const RESERVED_SLUGS = new Set(["ticket"]);

async function uniqueSlug(db: DbExecutor, name: string): Promise<string> {
  const slug = slugify(name);
  const base = RESERVED_SLUGS.has(slug) ? `${slug}-team` : slug;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${randomBytes(2).toString("hex")}`;
    const [taken] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, candidate));
    if (!taken) return candidate;
  }
  return `${base}-${randomBytes(4).toString("hex")}`;
}

/**
 * Self-serve sign-up: creates the user, a new organization on the Free plan
 * and makes the user its owner, all in one transaction.
 */
export async function registerOrganization(
  db: DbExecutor,
  input: SignupInput,
  options: { passwordRounds?: number } = {},
): Promise<Actor> {
  const passwordHash = await hashPassword(input.password, options.passwordRounds);

  const ids = await db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, input.email));
    if (existing) throw new ConflictError("An account with this email already exists. Sign in instead.");

    const [user] = await tx
      .insert(users)
      .values({ email: input.email, name: input.name, passwordHash })
      .onConflictDoNothing()
      .returning({ id: users.id });
    if (!user) throw new ConflictError("An account with this email already exists. Sign in instead.");

    const [org] = await tx
      .insert(organizations)
      .values({ name: input.orgName, slug: await uniqueSlug(tx, input.orgName), plan: "free" })
      .returning({ id: organizations.id, slug: organizations.slug });
    if (!org) throw new Error("Organization insert returned no row");

    await tx.insert(memberships).values({ orgId: org.id, userId: user.id, role: "owner" });
    await recordAudit(tx, { orgId: org.id, userId: user.id }, {
      action: "organization.created",
      entityType: "organization",
      entityId: org.id,
      metadata: { slug: org.slug },
    });
    return { userId: user.id, orgId: org.id };
  });

  const actor = await loadActor(db, ids);
  if (!actor) throw new Error("New membership could not be loaded");
  return actor;
}
