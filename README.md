# Relaydesk

## What is this?

**Relaydesk** is a _client-support desk built for agencies_. Each agency is an organization with owners, admins, agents and viewers. Clients send requests through the agency's **support portal** or by *email*, and every request becomes a ticket with a status, priority, assignee, threaded replies, internal notes and a field-level audit log.

Agents can ask the AI to ***summarise a thread*** or **_draft a reply_**, streamed into the page as it is written. Agencies pay through Stripe (*Free*, **Pro**, _Business_).

## Who is it for?

* Agencies with **several clients** to support
* Teams that need _roles that are actually enforced_
* Mobile apps, through the ***JWT REST API***

## Demo accounts

All demo accounts use the password `relaydesk-demo`.

* **Owner**: `olivia@northwind.test`
* *Admin*: `adam@northwind.test`
* __Agent__: `aisha@northwind.test`
* _Agent_: `marco@northwind.test`
* **Viewer**: `victor@northwind.test`
* Second tenant: `gina@globex.test` (*Globex Studio*, Free plan)

## How do I run it?

```bash
git clone <your-fork-url> relaydesk
cd relaydesk
npm install
cp .env.example .env.local
npm run db:seed
npm run dev
```

Open `http://localhost:3000/login`. **Note:** _PGlite allows one process at a time_, so stop the dev server before seeding again.

## REST API

All endpoints except login take `Authorization: Bearer <token>`.

### POST /api/v1/auth/login

Email and password, returns a 12-hour access token.

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "aisha@northwind.test",
    "password": "relaydesk-demo"
  }'
```

### GET /api/v1/me

Current user, organization, role and permissions.

```bash
curl http://localhost:3000/api/v1/me \
  -H "Authorization: Bearer <token>"
```

### GET /api/v1/tickets

List tickets. Filters: status, priority, assignee, `q`, paging.

```bash
curl "http://localhost:3000/api/v1/tickets?q=<search>" \
  -H "Authorization: Bearer <token>"
```

### POST /api/v1/tickets

Create a ticket.

```bash
curl -X POST http://localhost:3000/api/v1/tickets \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "subject": "<subject>" }'
```

### GET /api/v1/tickets/:id

Ticket detail.

```bash
curl http://localhost:3000/api/v1/tickets/<id> \
  -H "Authorization: Bearer <token>"
```

### PATCH /api/v1/tickets/:id

Update status, priority, assignee or subject.

```bash
curl -X PATCH http://localhost:3000/api/v1/tickets/<id> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "subject": "<new subject>" }'
```

### GET /api/v1/tickets/:id/comments

The thread.

### POST /api/v1/tickets/:id/comments

A reply or an internal note.

### POST /api/v1/ai/summary

```json
{ "ticketId": "<id>", "task": "summary", "stream": true }
```

`task` is `"summary"` or `"reply"`.

### GET /api/v1/members

Organization members.

### POST /api/v1/devices/push-token

Register an Expo push token.

### Errors

```json
{ "error": { "code": "...", "message": "...", "details": "..." } }
```

_422_ validation, **402** plan limits, ***429*** rate limits (with `Retry-After`).

## Demo accounts (again)

The **Try the sample workspace** box on `/login` fills these in for _Northwind Agency_ (Pro plan, 22 tickets, 5 members):

| Role | Email |
|---|---|
| Owner | `olivia@northwind.test` |
| Admin | `adam@northwind.test` |
| Agent | `aisha@northwind.test`, `marco@northwind.test` |
| Viewer | `victor@northwind.test` |

Password: **`relaydesk-demo`**. *Globex Studio* (`gina@globex.test`) shows tenant isolation. Plans: __Free__ 3 seats, *Pro* 10, **Business** 50.