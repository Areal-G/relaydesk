import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://relaydesk:relaydesk@localhost:5432/relaydesk",
  },
  strict: true,
  verbose: true,
});
