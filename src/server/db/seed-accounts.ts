import type { Role } from "@/lib/domain";
import type { StaffKey } from "./seed-data";

/** Sample workspaces created by `npm run seed` (see scripts/seed.ts). */
export const SAMPLE_ORG = { name: "Northwind Agency", slug: "northwind" } as const;
export const SECOND_SAMPLE_ORG = { name: "Globex Studio", slug: "globex" } as const;

/** Password of every sample account when SEED_OWNER_PASSWORD is unset. Local use only. */
export const DEFAULT_SEED_PASSWORD = "change-me-locally";

export interface SeedAccount {
  key: StaffKey | "victor";
  email: string;
  name: string;
  role: Role;
}

/** One Northwind member per role; the owner's email and name can be overridden when seeding. */
export const SAMPLE_ACCOUNTS: SeedAccount[] = [
  { key: "olivia", email: "olivia@northwind.test", name: "Olivia Bennett", role: "owner" },
  { key: "adam", email: "adam@northwind.test", name: "Adam Clarke", role: "admin" },
  { key: "aisha", email: "aisha@northwind.test", name: "Aisha Khan", role: "agent" },
  { key: "marco", email: "marco@northwind.test", name: "Marco Rossi", role: "agent" },
  { key: "victor", email: "victor@northwind.test", name: "Victor Hughes", role: "viewer" },
];

export const SECOND_ORG_ACCOUNT = { email: "gina@globex.test", name: "Gina Patel", role: "owner" as Role };
