# Relaydesk

## What is this?

Relaydesk is a client-support desk for agencies. Clients send requests through a support portal or by email, and every request becomes a ticket the agency's team can work on together.

* Shared ticket queue with status, priority and assignee
* Threaded replies and internal notes
* Roles: owner, admin, agent and viewer
* A client portal at `/support/<slug>`
* AI summaries and reply drafts
* Stripe billing (Free, Pro, Business)

## Who is it for?

* Agencies that handle support for several clients
* Teams that need clear roles and permissions
* Anyone who wants a support desk they can run themselves

## How do I run it?

You need Node.js 22+ and npm. The database is PGlite (PostgreSQL in WebAssembly), so nothing else needs to be installed.

```bash
git clone <your-fork-url> relaydesk
cd relaydesk
npm install
cp .env.example .env.local
npm run db:seed
npm run dev
```

Open `http://localhost:3000/login`.

* Without an `ANTHROPIC_API_KEY` the AI uses an offline mock.
* Without Stripe keys, billing shows a "not connected" notice.