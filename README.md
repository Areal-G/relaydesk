# Relaydesk

![Next.js](https://img.shields.io/badge/Next.js-16.4-000?logo=nextdotjs)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Drizzle_+_PGlite-336791?logo=postgresql&logoColor=white)
![Tests](https://img.shields.io/badge/Vitest-104_passing-6e9f18?logo=vitest&logoColor=white)

**The client-support desk built for agencies.** A shared ticket queue with roles, a client portal, streamed AI summaries and reply drafts, and Stripe billing.

## Overview

Each agency is an organization with owners, admins, agents and viewers. Clients send requests through the agency's support portal or by email, and every request becomes a ticket with:

- a per-organization number, status, priority and assignee
- threaded replies and amber internal notes the customer never sees
- a field-level audit log, written in the same transaction as the change

On any ticket, agents can click **Summarise thread** or **Draft reply**. The text streams into the side panel token by token, can be stopped mid-sentence, and **Use as reply** drops it into the composer. Internal notes inform the draft but are never quoted to the customer.

- The AI runs on the Anthropic SDK behind an `AiProvider` interface, with a deterministic offline mock when no key is set.
- Each request is guarded by the `ai:use` permission, a 10-per-minute burst limit and the plan's monthly quota.
- Every generation records model, tokens and latency, which feeds the usage meter on the billing page.

The dashboard shows open, awaiting-customer, urgent and resolved counts, a 14-day chart of new tickets, the shareable portal link and a live activity feed. The ticket queue has filters for status, priority and assignee, full-text search and pagination.

Agencies pay through Stripe, and limits are checked on every write:

| Plan | Seats | AI assists / month |
|---|---|---|
| Free | 3 | 25 |
| Pro | 10 | 500 |
| Business | 50 | 5,000 |

The same backend also serves a JWT-authenticated REST API (`/api/v1`) for a companion mobile app.

## Roles & permissions

One permission matrix is rendered live on the team page and enforced on the server.

| | Owner | Admin | Agent | Viewer |
|---|:---:|:---:|:---:|:---:|
| View tickets and dashboard | Yes | Yes | Yes | Yes |
| Work tickets and reply | Yes | Yes | Yes | No |
| Internal notes | Yes | Yes | Yes | No |
| AI assist (`ai:use`) | Yes | Yes | Yes | No |
| Manage team members | Yes | Yes | No | No |
| Billing | Yes | Read-only | No | No |
| Grant or revoke owner | Yes | No | No | No |

- An organization always keeps at least one owner.
- When a member is removed, their open tickets go back to the queue.
- Roles are re-read on every request, so a change takes effect immediately.
- A viewer sees the same pages without Billing, without the Add member form and with read-only controls; the API returns 403.

Every service function checks the permission first and then scopes its query by organization, so another tenant's ticket is simply not found:

```ts
// src/server/rbac.ts
export function requirePermission(actor: Actor | null | undefined, permission: Permission): asserts actor is Actor {
  if (!actor) throw new UnauthorizedError();
  if (!can(actor.role, permission)) {
    throw new ForbiddenError(`Your role (${actor.role}) does not allow ${permission}`);
  }
}
```

The web UI, the portal and the mobile API all go through this same service layer, so there is one enforcement path.

## Support portal

Each agency gets a public portal at `/support/<slug>`. Clients open a ticket there without creating an account.

Every client then gets a private link to follow and answer their thread. The link is a random secret stored only as a SHA-256 hash, and an agent can rotate it if it gets lost.

## Email intake

Set `INBOUND_EMAIL_SECRET` and Relaydesk accepts forwarded mail at:

```
POST /api/inbound/email
```

Each message becomes a ticket, the same as a portal request. The secret is sent as a bearer token. Leave it unset and the endpoint stays off.

## Running it

You need Node.js 22+ and npm. Docker is optional. Locally the database is [PGlite](https://pglite.dev), real PostgreSQL compiled to WebAssembly.

```bash
git clone <your-fork-url> relaydesk
cd relaydesk
npm install
cp .env.example .env.local
npm run db:seed
npm run dev
```

Open `http://localhost:3000/login`.

`db:seed` applies the migrations and loads the demo workspaces. PGlite allows one process at a time, so stop the dev server before seeding again.

### Demo workspace

The **Try the sample workspace** box on `/login` signs you into *Northwind Agency* (Pro plan, 22 tickets, 5 members). The password for every account is `relaydesk-demo`.

| Role | Email |
|---|---|
| Owner | `olivia@northwind.test` |
| Admin | `adam@northwind.test` |
| Agent | `aisha@northwind.test`, `marco@northwind.test` |
| Viewer | `victor@northwind.test` |

`gina@globex.test` (Globex Studio, Free plan) is a second tenant for checking isolation. The client portal is at `/support/northwind`.

### Tests

```bash
npm run lint
npm run typecheck
npm test
```

104 Vitest tests run against in-memory PGlite with the real migrations: no Docker, no ORM mocks. They cover:

- the RBAC matrix and role rules
- tenant isolation, with cross-tenant reads and writes tried through every service
- the Stripe webhook: bad signatures, duplicates, out-of-order events and downgrades
- AI streaming, quotas and usage records
- the client portal, email intake, rate limits and the mobile endpoints

## Configuration

Every variable is optional for local development. Without an `ANTHROPIC_API_KEY` the AI runs on an offline mock, and without Stripe keys billing shows a "not connected" notice.

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL URL. When unset, PGlite in `.pglite` is used |
| `AUTH_SECRET` | Key for sessions and API tokens, 32+ characters |
| `APP_URL` | Public base URL for portal links and Stripe redirects |
| `TRUSTED_PROXY_HOPS` | Proxies in front of the app; `X-Forwarded-For` is only trusted when set |
| `NEXT_PUBLIC_DEMO_MODE` | Shows the sample-workspace buttons; `false` in production |
| `INBOUND_EMAIL_SECRET` | Turns on email intake |
| `ANTHROPIC_API_KEY`, `AI_MODEL` | Real AI output |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS` | Billing |
| `DD_ENV`, `DD_API_KEY`, `DD_AGENT_HOST`, ... | Datadog APM, logs and metrics |

To use real PostgreSQL instead of PGlite:

```bash
docker compose up -d
export DATABASE_URL=postgres://relaydesk:relaydesk@localhost:5432/relaydesk
npm run db:migrate && npm run db:seed
```

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` / `npm run typecheck` | ESLint / type check |
| `npm test` | Vitest |
| `npm run db:generate` | Generate a migration from the Drizzle schema |
| `npm run db:migrate` / `npm run db:seed` | Apply migrations / load demo data |

### Mobile API

The REST API under `/api/v1` takes `Authorization: Bearer <token>` on every endpoint except `POST /api/v1/auth/login`, which trades an email and password for a 12-hour token. It covers tickets, comments, AI summaries, members and Expo push-token registration. Errors share one shape, `{ "error": { "code", "message", "details?" } }`, with 422 for validation, 402 for plan limits and 429 for rate limits.

### Production

Relaydesk runs anywhere Node 22 does, with `npm run build && npm start`.

- Point `DATABASE_URL` at PostgreSQL and run `npm run db:migrate` on release.
- Set a strong `AUTH_SECRET`, the public `APP_URL` and `TRUSTED_PROXY_HOPS`.
- Turn `NEXT_PUBLIC_DEMO_MODE` off.
- Point the Stripe webhook at `/api/stripe/webhook`. Signatures are checked on the raw body and redelivered events are ignored.
- Optionally add the Datadog variables; `observability/` holds an importable dashboard and monitors.

## Planned

- Rate limits in Redis for multi-instance deployments.
- Invitation emails instead of one-time temporary passwords.
- Saved views and SLA timers on the ticket queue.
- A dark theme.

## Built with

Next.js 16.4 and React 19.3, TypeScript (strict), Tailwind CSS 4, PostgreSQL with Drizzle ORM, `jose` JWTs, zod 4, Stripe, the Anthropic SDK, and Vitest.