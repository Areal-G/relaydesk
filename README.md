<div align="center">

<img src="readme/logo.svg" width="72" alt="Relaydesk logo">

# Relaydesk

**The client-support desk built for agencies.**
A shared ticket queue with roles, a client portal, streamed AI summaries and reply drafts, and Stripe billing, multi-tenant from the first query.

![Next.js](https://img.shields.io/badge/Next.js-16.4-000?logo=nextdotjs)
![React](https://img.shields.io/badge/React-19.3-61dafb?logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Drizzle_+_PGlite-336791?logo=postgresql&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-billing-635bff?logo=stripe&logoColor=white)
![Tests](https://img.shields.io/badge/Vitest-104_passing-6e9f18?logo=vitest&logoColor=white)
[![Live demo](https://img.shields.io/badge/demo-live-4f46e5)](https://relaydesk.arealjagema.com)

[Features](#features) · [Design](#design) · [Screenshots](#screenshots) · [Tech stack](#tech-stack) · [Getting started](#getting-started)

</div>

<img alt="Relaydesk ticket with an AI-drafted reply on desktop, and the dashboard on mobile" src="readme/hero.png">

## Overview

Each agency is an organization with owners, admins, agents and viewers. Clients send requests through the agency's support portal or by email, and every request becomes a ticket with a status, priority, assignee, threaded replies, internal notes and a field-level audit log. Agents can ask the AI to summarise a long thread or draft a reply, streamed into the page as it is written. Agencies pay through Stripe (Free, Pro, Business), and seat and AI-quota limits are enforced on the server.

The same backend serves a JWT-authenticated REST API (`/api/v1`) for a companion mobile app.

Locally it needs nothing but Node: the database is [PGlite](https://pglite.dev), real PostgreSQL compiled to WebAssembly. Without API keys the AI runs on an offline mock provider and billing shows a "not connected" notice.

## Try the demo

A live demo runs at **[relaydesk.arealjagema.com](https://relaydesk.arealjagema.com)**. Its **Try the sample workspace** box on `/login` fills in one-click accounts for *Northwind Agency* (Pro plan, 22 tickets, 5 members). The demo is built from the [`demo`](https://github.com/Areal-G/relaydesk/tree/demo) branch, which keeps its database in memory.

Locally, `npm run seed` creates the same workspace (see [Getting started](#getting-started)). Every sample account uses `SEED_OWNER_PASSWORD`, or `change-me-locally` when it is unset:

| Role | Email | What to look at |
|---|---|---|
| Owner | `olivia@northwind.test` | Everything, including billing and promoting owners |
| Admin | `adam@northwind.test` | Team management; billing is read-only |
| Agent | `aisha@northwind.test`, `marco@northwind.test` | Work tickets, internal notes, AI assist |
| Viewer | `victor@northwind.test` | Read-only: controls are hidden or disabled and APIs return 403 |

A second tenant, `gina@globex.test` (Globex Studio, Free plan), shows tenant isolation. You can also create your own workspace at `/signup` and open the client portal at `/support/northwind`.

## Features

### AI assist that knows the whole thread

On any ticket, **Summarise thread** or **Draft reply** streams text token by token into the side panel, with a stop button, then **Use as reply** drops it into the composer. Internal notes inform the draft but are never quoted to the customer. (Shown in the header image above.)

- Runs on the Anthropic SDK behind an `AiProvider` interface; a deterministic mock takes over when `ANTHROPIC_API_KEY` is unset.
- Guarded by the `ai:use` permission, a 10-per-minute burst limit, the plan's monthly quota and a prompt that fences ticket content as untrusted data.
- Every generation records model, tokens and latency in `ai_usage`, which feeds the usage meter on the billing page.

### A dashboard for the whole queue

Open, awaiting-customer, urgent and resolved counts, a 14-day chart of new tickets, the shareable portal link and a live activity feed of who did what on which ticket.

<img alt="Dashboard with ticket counts, the 14-day chart and recent activity" src="readme/dashboard.png">

### Ticket queue

Per-organization numbering, filters for status, priority and assignee plus full-text search, with pagination. Status and priority are colour-coded the same way everywhere they appear.

<img alt="Ticket queue with filters" src="readme/tickets.png">

### Roles you can see

One permission matrix (owner, admin, agent, viewer) is rendered live on the team page and enforced on the server. Owners alone can grant or revoke the owner role, an organization always keeps at least one owner, and a removed member's open tickets go back to the queue.

<img alt="Team and roles page with the permission matrix" src="readme/team.png">

### Billing with real limits

Stripe Checkout and the Customer Portal, a signature-verified, idempotent webhook, and plan limits checked on every write: Free has 3 seats and 25 AI assists a month, Pro 10 and 500, Business 50 and 5,000.

<img alt="Billing page with plan, usage meters and plan cards" src="readme/billing.png">

### Everything else

| Area | What you get |
|---|---|
| **Client portal** | `/support/<slug>` takes requests without an account; each client gets a private link (stored only as a SHA-256 hash) to follow and answer the thread |
| **Email intake** | `POST /api/inbound/email` turns forwarded mail into tickets when `INBOUND_EMAIL_SECRET` is set |
| **Internal notes** | Amber cards on the same thread, hidden from the customer |
| **Audit trail** | Field-level changes written in the same transaction as the change itself |
| **Mobile API** | JWT bearer auth, ticket and comment endpoints, Expo push-token registration |
| **Observability** | `dd-trace` APM, `pino` JSON logs with trace IDs, DogStatsD metrics, and an importable Datadog dashboard |
| **Onboarding** | `/signup` creates a workspace and its first owner |

## Design

Relaydesk is a quiet, light, slate-and-indigo interface: white cards on a `slate-50` page, one indigo brand ramp (`#eef2ff → #4338ca`) for primary actions and the active nav item, and colour reserved for meaning. Type is Geist, with Geist Mono for ticket numbers and links.

- **Tokens in one place.** The brand ramp lives in a Tailwind 4 `@theme` block in `src/app/globals.css`; components use `brand-*` and Tailwind's slate scale, never raw hex values.
- **Colour means something.** Green is resolved, amber is pending or an internal note, red is urgent. An internal note is always amber so nobody mistakes it for a customer reply.
- **Permissions show in the UI.** A viewer sees the same pages without Billing, without the Add member form and with read-only controls, so the role model is visible, not just enforced.
- **Streaming feels live.** AI text arrives with a blinking caret (`.ai-caret`) and can be stopped mid-sentence.
- **Small screens.** The sidebar becomes one row of tabs that scrolls sideways, the ticket list shows each status under its subject, cards stack in one column, the team page moves each role selector under the member's email, and the client portal is a single centred form.
- **Light only.** The app sets `color-scheme: light`; there is no dark theme yet.

<img alt="Relaydesk on mobile: the ticket list, a ticket conversation and the team and roles page" src="readme/mobile.png">

## Screenshots

<table>
  <tr>
    <td width="50%"><img src="readme/ticket-summary.png" alt="AI thread summary"><br><sub><b>AI summary</b>: key facts and next step for a ticket</sub></td>
    <td width="50%"><img src="readme/portal.png" alt="Client portal"><br><sub><b>Client portal</b>: clients open tickets without an account</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="readme/viewer-team.png" alt="Team page as a viewer"><br><sub><b>Viewer role</b>: no billing, no member management</sub></td>
    <td width="50%"><img src="readme/new-ticket.png" alt="New ticket form"><br><sub><b>New ticket</b> on behalf of a client</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="readme/login.png" alt="Sign in"><br><sub><b>Sign in</b> with the sample-workspace accounts</sub></td>
    <td width="50%"></td>
  </tr>
</table>

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| Framework | Next.js 16.4 (App Router, Server Actions, Route Handlers, Cache Components), React 19.3 | Server-rendered pages, actions and a REST API in one app |
| Language | TypeScript (strict, `noUncheckedIndexedAccess`) | Array and record lookups are checked too |
| UI | Tailwind CSS 4, lucide-react | Token-based styling with no component library to fight |
| Database | PostgreSQL, Drizzle ORM 0.45, committed SQL migrations; PGlite locally and in tests | Same schema and migrations everywhere, no Docker needed |
| Auth | `jose` HS256 JWTs (separate web and API audiences), `bcryptjs` | One secret, two token types that can't be swapped |
| Validation | zod 4 | Shared validators for actions and the REST API |
| Billing | Stripe 23 (Checkout, Customer Portal, webhooks) | Hosted payment pages, no card data on our side |
| AI | `@anthropic-ai/sdk` with streaming; offline mock provider | Real output with a key, deterministic output without |
| Observability | `dd-trace`, `pino`, DogStatsD | Traces, logs and metrics joined by trace ID |
| Tests | Vitest against in-memory PGlite | Real SQL in every test, no ORM mocks |

## Architecture

```mermaid
flowchart LR
    subgraph clients["Clients"]
        web["Web app<br/>Server Components"]
        portal["Client portal<br/>/support/:slug"]
        mobile["Mobile app"]
    end
    subgraph next["Next.js 16"]
        actions["Pages & Server Actions"]
        v1["REST API /api/v1"]
        aiRoute["AI stream<br/>/api/tickets/:id/ai"]
        hooks["Stripe webhook ·<br/>inbound email"]
        services["Service layer<br/>requirePermission() · org_id scoping<br/>zod · rate limits · entitlements"]
        actions --> services
        v1 --> services
        aiRoute --> services
        hooks --> services
    end
    web -- "httpOnly session cookie" --> actions
    web -- "ReadableStream" --> aiRoute
    portal -- "private ticket link" --> actions
    mobile -- "JWT bearer" --> v1
    services --> db[("PostgreSQL / PGlite<br/>Drizzle ORM")]
    services -- "AiProvider" --> llm["Anthropic API<br/>or offline mock"]
    actions -- "Checkout / Portal" --> stripe["Stripe"]
    stripe -- "signed events" --> hooks
```

- **The service layer is the security boundary.** Pages, actions and route handlers stay thin. Each `src/server/**/service.ts` function takes `(db, actor, input)`, checks the permission and scopes every query by `actor.orgId`, so the web UI, the portal and the mobile API share one enforcement path.
- **Roles are re-read on every request**, so a role change or removal takes effect immediately.
- **One driver-agnostic Drizzle handle.** `node-postgres` in production, PGlite in development and tests, from the same migrations in `drizzle/`.
- **Streaming with pre-flight checks.** Permission, rate limit, quota and ticket access are checked before the AI stream opens, so failures still return proper HTTP status codes.

## Engineering highlights

- **Tenant isolation is tested, not assumed.** A dedicated suite tries cross-tenant reads and writes through every service and expects a 404 and no change.
- **Idempotent, ordered billing.** Webhook signatures are checked on the raw body, the event id is stored in the same transaction as its effects, and events older than the last applied one (`billing_event_at`) are skipped.
- **Private links done right.** Customer ticket links are random secrets stored only as SHA-256 hashes, and an agent can rotate a lost one.
- **Honest proxies.** `X-Forwarded-For` is trusted only when `TRUSTED_PROXY_HOPS` says how many proxies sit in front, so rate limits can't be dodged with a forged header.

Every service starts the same way: check the permission, then scope by organization.

```ts
// src/server/rbac.ts
export function requirePermission(actor: Actor | null | undefined, permission: Permission): asserts actor is Actor {
  if (!actor) throw new UnauthorizedError();
  if (!can(actor.role, permission)) {
    throw new ForbiddenError(`Your role (${actor.role}) does not allow ${permission}`);
  }
}

// src/server/tickets/service.ts (trimmed)
export async function getTicket(db: DbExecutor, actor: Actor, ticketId: string) {
  requirePermission(actor, "ticket:read");
  const [ticket] = await db
    .select({ ...ticketColumns, description: tickets.description })
    .from(tickets)
    .leftJoin(users, eq(users.id, tickets.assigneeId))
    .where(and(eq(tickets.id, ticketId), eq(tickets.orgId, actor.orgId)))
    .limit(1);
  if (!ticket) throw new NotFoundError("Ticket not found"); // another tenant's id is simply not found
  return ticket;
}
```

A redelivered Stripe event is recognised by its id inside the same transaction that applies it:

```ts
// src/server/billing/webhook.ts (trimmed)
return deps.db.transaction(async (tx) => {
  const inserted = await tx
    .insert(stripeEvents)
    .values({ id: event.id, type: event.type })
    .onConflictDoNothing({ target: stripeEvents.id })
    .returning({ id: stripeEvents.id });
  if (inserted.length === 0) return { eventId: event.id, type: event.type, status: "duplicate" };

  const applied = await applyEvent(tx, event, deps.priceToPlan);
  return { eventId: event.id, type: event.type, status: applied ? "processed" : "ignored" };
});
```

## Getting started

### Prerequisites

- Node.js 22+ and npm. Docker is optional, for real PostgreSQL.

### Install, seed and run

```bash
git clone <your-fork-url> relaydesk
cd relaydesk
npm install
cp .env.example .env.local
```

```bash
npm run seed
```

```bash
npm run dev
```

Open `http://localhost:3000/login` and sign in as `olivia@northwind.test` (or your `SEED_OWNER_EMAIL`). `npm run seed` applies the migrations and loads the sample workspaces. PGlite allows one process at a time, so stop the dev server before seeding again. Seeding clears the database first, refuses to run with `NODE_ENV=production`, and sets all sample dates relative to the time you seed.

<details>
<summary><b>Environment variables</b></summary>

Every variable is optional for local development.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Production | PostgreSQL URL. When unset, PGlite in `.pglite` is used |
| `PGLITE_DATA_DIR` | No | PGlite directory (default `.pglite`) |
| `AUTH_SECRET` | Production | HS256 key for sessions and API tokens, 32+ characters |
| `APP_URL` | Yes | Public base URL, used for portal links and Stripe redirects |
| `TRUSTED_PROXY_HOPS` | No | Number of proxies in front of the app; `X-Forwarded-For` is only trusted when this is set |
| `SEED_OWNER_EMAIL`, `SEED_OWNER_NAME` | No | Owner account created by `npm run seed` (default `olivia@northwind.test`) |
| `SEED_OWNER_PASSWORD` | No | Password of every sample account (default `change-me-locally`) |
| `INBOUND_EMAIL_SECRET` | No | Bearer secret that enables `/api/inbound/email` |
| `ANTHROPIC_API_KEY`, `AI_MODEL` | No | Real AI output (default model `claude-sonnet-5-5`) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS` | No | Billing in Stripe test or live mode |
| `DD_ENV`, `DD_API_KEY`, `DD_AGENT_HOST`, ... | No | Datadog APM, logs and metrics |

To use real PostgreSQL instead of PGlite:

```bash
docker compose up -d
```

```bash
export DATABASE_URL=postgres://relaydesk:relaydesk@localhost:5432/relaydesk
npm run db:migrate && npm run seed
```

</details>

<details>
<summary><b>Scripts</b></summary>

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run start:datadog` | Start with `dd-trace` preloaded (POSIX shells) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `next typegen && tsc --noEmit` |
| `npm test` / `npm run test:watch` | Vitest |
| `npm run db:generate` | Generate a migration from the Drizzle schema |
| `npm run db:migrate` / `npm run seed` | Apply migrations / load sample data |

</details>

<details>
<summary><b>REST API</b></summary>

All endpoints except login take `Authorization: Bearer <token>`. Errors share one shape: `{ "error": { "code", "message", "details?" } }`. Validation failures return 422, plan limits 402, and rate limits 429 with `Retry-After`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/auth/login` | Email and password → 12-hour access token |
| `GET` | `/api/v1/me` | Current user, organization, role and permissions |
| `GET` / `POST` | `/api/v1/tickets` | List (status, priority, assignee, `q`, paging) / create |
| `GET` / `PATCH` | `/api/v1/tickets/:id` | Detail / update status, priority, assignee, subject |
| `GET` / `POST` | `/api/v1/tickets/:id/comments` | Thread / reply or internal note |
| `POST` | `/api/v1/ai/summary` | `{ ticketId, task: "summary" \| "reply", stream? }` |
| `GET` | `/api/v1/members` | Organization members |
| `POST` | `/api/v1/devices/push-token` | Register an Expo push token |

</details>

<details>
<summary><b>Project structure</b></summary>

```
src/
├── app/
│   ├── (app)/            dashboard, tickets, team, billing (+ server actions)
│   ├── login/ signup/    auth pages
│   ├── support/          client portal and private ticket links
│   └── api/              v1 REST API, AI stream, Stripe webhook, inbound email
├── components/           UI primitives, app shell, ticket, team, billing, AI panel
├── lib/                  permission matrix, plans, zod validators
└── server/
    ├── auth/             passwords, JWTs, sessions, bearer auth
    ├── ai/               provider interface, Anthropic and mock providers, prompts
    ├── billing/          Stripe client, checkout, webhook, entitlements
    ├── portal/           portal and inbound-email services
    ├── tickets/ team/    domain services
    ├── db/               Drizzle schema, client (pg / PGlite), seed
    └── observability/    tracer, logger, metrics
drizzle/                  SQL migrations
observability/            Datadog dashboard and monitors (JSON)
tests/                    Vitest suites
```

</details>

## Testing and quality

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
npm test
```

- 12 Vitest suites with 104 tests run against in-memory PGlite using the real migrations and seed: no Docker and no ORM mocks.
- They cover the RBAC matrix and role rules, tenant isolation, the Stripe webhook (bad signatures, duplicates, out-of-order events, downgrades), AI streaming, quotas and usage records, the client portal and email intake, rate limits, validators, the mobile endpoints and log/trace correlation.

## Deployment

Deploy anywhere that runs Node 22 with `npm run build && npm start` (Vercel, Fly.io, a container). For production:

- Point `DATABASE_URL` at PostgreSQL and run `npm run db:migrate` on release.
- Set a strong `AUTH_SECRET`, the public `APP_URL`, `TRUSTED_PROXY_HOPS` for your proxy chain.
- Add Stripe keys and point the webhook at `/api/stripe/webhook`.
- Optionally set `ANTHROPIC_API_KEY`, `INBOUND_EMAIL_SECRET` and the Datadog variables; `observability/` holds an importable dashboard and monitors.

## Roadmap

- Move rate limits from memory to Redis for multi-instance deployments.
- Invitation emails instead of one-time temporary passwords.
- Refresh tokens for the mobile API.
- A workspace switcher for users who belong to several organizations.
- Saved views and SLA timers on the ticket queue.
- A dark theme.