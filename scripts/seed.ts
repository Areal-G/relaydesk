/**
 * Loads sample data (two organizations, a user per role, a realistic ticket
 * queue). Destructive: it truncates existing data first, so it refuses to run
 * with NODE_ENV=production. Stop `npm run dev` first when using PGlite, since
 * the embedded database allows one process at a time.
 *
 * SEED_OWNER_EMAIL / SEED_OWNER_NAME replace the Northwind owner, and
 * SEED_OWNER_PASSWORD is the password of every sample account.
 */
import { createDatabase } from "@/server/db/client";
import { seedSampleData } from "@/server/db/seed";
import { DEFAULT_SEED_PASSWORD, SAMPLE_ACCOUNTS } from "@/server/db/seed-accounts";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed sample data with NODE_ENV=production");
  }
  const owner = { email: process.env.SEED_OWNER_EMAIL || undefined, name: process.env.SEED_OWNER_NAME || undefined };
  const password = process.env.SEED_OWNER_PASSWORD || DEFAULT_SEED_PASSWORD;

  const url = process.env.DATABASE_URL;
  const handle = await createDatabase(
    url ? { url, migrate: true } : { dataDir: process.env.PGLITE_DATA_DIR ?? ".pglite", migrate: true },
  );
  await seedSampleData(handle.db, { owner, password });
  await handle.close();

  const passwordHint = process.env.SEED_OWNER_PASSWORD ? "SEED_OWNER_PASSWORD" : DEFAULT_SEED_PASSWORD;
  console.log(`Seeded sample data (${handle.driver}). Sign in with any of these (password: ${passwordHint}):`);
  for (const account of SAMPLE_ACCOUNTS) {
    const email = account.role === "owner" ? (owner.email ?? account.email) : account.email;
    console.log(`  ${account.role.padEnd(7)} ${email}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
