import { SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authenticateBearer } from "@/server/auth/bearer";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { authenticate } from "@/server/auth/service";
import { signToken, verifyToken } from "@/server/auth/tokens";
import { UnauthorizedError } from "@/server/errors";
import { changeMemberRole, removeMember } from "@/server/team/service";
import { createTestDb, type TestDb } from "./support/db";
import { DEFAULT_SEED_PASSWORD } from "@/server/db/seed-accounts";

describe("passwords", () => {
  it("hashes with bcrypt and verifies", async () => {
    const hash = await hashPassword("correct horse", 4);
    expect(hash).toMatch(/^\$2[aby]\$04\$/);
    expect(await verifyPassword("correct horse", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});

describe("JWT tokens", () => {
  const claims = { userId: "4f1c2b8e-9d3a-4e5f-8a7b-1c2d3e4f5a6b", orgId: "5a1c2b8e-9d3a-4e5f-8a7b-1c2d3e4f5a6b" };

  it("round-trips claims for the same audience", async () => {
    const token = await signToken(claims, "relaydesk:api");
    await expect(verifyToken(token, "relaydesk:api")).resolves.toEqual(claims);
  });

  it("rejects a session cookie token used as an API bearer token (audience separation)", async () => {
    const token = await signToken(claims, "relaydesk:web");
    await expect(verifyToken(token, "relaydesk:api")).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("rejects expired and foreign-signed tokens", async () => {
    const expired = await signToken(claims, "relaydesk:api", -10);
    await expect(verifyToken(expired, "relaydesk:api")).rejects.toThrow("Token expired");

    const forged = await new SignJWT({ org: claims.orgId })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(claims.userId)
      .setIssuer("relaydesk")
      .setAudience("relaydesk:api")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("some-other-secret-some-other-secret-1234"));
    await expect(verifyToken(forged, "relaydesk:api")).rejects.toThrow("Invalid token");
  });
});

describe("authentication against the database", () => {
  let t: TestDb;
  beforeAll(async () => {
    t = await createTestDb();
  });
  afterAll(() => t.handle.close());

  it("authenticates seeded users into their organization", async () => {
    const actor = await authenticate(t.db, { email: "olivia@northwind.test", password: DEFAULT_SEED_PASSWORD });
    expect(actor).toMatchObject({ role: "owner", orgName: "Northwind Agency", plan: "pro" });
  });

  it("gives the same error for unknown emails and wrong passwords", async () => {
    await expect(authenticate(t.db, { email: "nobody@northwind.test", password: DEFAULT_SEED_PASSWORD })).rejects.toThrow(
      "Invalid email or password",
    );
    await expect(authenticate(t.db, { email: "olivia@northwind.test", password: "nope" })).rejects.toThrow(
      "Invalid email or password",
    );
  });

  it("authenticates bearer tokens and always reads the current role from the database", async () => {
    const { userId } = await t.actor(t.seed.northwind.users.marco);
    const token = await signToken({ userId, orgId: t.seed.northwind.orgId }, "relaydesk:api");
    const request = (value?: string) =>
      new Request("http://localhost/api/v1/me", { headers: value ? { authorization: value } : {} });

    await expect(authenticateBearer(t.db, request(`Bearer ${token}`))).resolves.toMatchObject({ role: "agent" });

    const owner = await t.actor(t.seed.northwind.users.olivia);
    await changeMemberRole(t.db, owner, userId, "viewer");
    await expect(authenticateBearer(t.db, request(`Bearer ${token}`))).resolves.toMatchObject({ role: "viewer" });

    await removeMember(t.db, owner, userId);
    await expect(authenticateBearer(t.db, request(`Bearer ${token}`))).rejects.toThrow("Membership no longer active");
    await expect(authenticateBearer(t.db, request())).rejects.toThrow("Missing bearer token");
    await expect(authenticateBearer(t.db, request("Basic abc"))).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
