import { sql } from "drizzle-orm";
import { createDatabase, type Database, type DatabaseHandle } from "./client";
import { seedDemoData } from "./seed";

/**
 * Swaps every `gen_random_uuid()` column default for a counter, so seeding the
 * same data in the same order produces the same IDs. Every serverless instance
 * builds its own in-memory database; matching IDs keep sessions and links valid
 * whichever instance serves the request.
 */
export async function makeIdsDeterministic(db: Database): Promise<void> {
  await db.execute(sql`create sequence demo_ids`);
  await db.execute(sql`
    create function demo_uuid() returns uuid language sql as $$
      select ('00000000-0000-4000-8000-' || lpad(to_hex(nextval('demo_ids')), 12, '0'))::uuid
    $$
  `);
  await db.execute(sql`
    do $$
    declare col record;
    begin
      for col in
        select table_name, column_name from information_schema.columns
        where table_schema = 'public' and column_default = 'gen_random_uuid()'
      loop
        execute format('alter table %I alter column %I set default demo_uuid()', col.table_name, col.column_name);
      end loop;
    end $$;
  `);
}

/** The demo's database: in-memory PGlite with the real migrations and the sample workspaces. */
export async function createDemoDatabase(): Promise<DatabaseHandle> {
  const handle = await createDatabase({ migrate: true });
  await makeIdsDeterministic(handle.db);
  // The demo password is public, so a low bcrypt cost keeps cold starts fast.
  await seedDemoData(handle.db, { passwordRounds: 8 });
  return handle;
}
