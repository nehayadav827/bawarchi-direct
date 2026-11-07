# Deployment

Repository: https://github.com/nehayadav827/bawarchi-direct
Live app: **[ADD LIVE URL HERE]**

## Demo logins (fictional accounts, password for all: `Demo@1234`)

| Role | Email | Lands on |
|---|---|---|
| Customer | `customer@demo.test` | Outlet picker, can order and track |
| Kitchen staff, Kondapur | `kitchen.kondapur@demo.test` | Kitchen display for Kondapur |
| Outlet manager, Kondapur | `manager.kondapur@demo.test` | Same, plus "Change time" override |
| Admin | `admin@demo.test` | Central menu admin |

Other outlets follow the same pattern: `kitchen.<outlet>@demo.test` and `manager.<outlet>@demo.test` with outlet ids `gachibowli-ck`, `kukatpally`, `banjara-hills`.

Test payments: card `4111 1111 1111 1111`, UPI `demo@okbank`. Use `fail@test` (UPI) or `4000 0000 0000 0002` (card) to see a decline. Nothing is charged.

Suggested 2-minute walkthrough: sign in as customer, order from Kondapur, keep the tracking page open. In a second window sign in as `kitchen.kondapur@demo.test` and move the order through the stages. The customer page updates. The seeded Kukatpally order is already late; sign in as `manager.kukatpally@demo.test` to see the alert banner and change its time.

## Run locally

Requirements: Node.js 22 and npm. No Docker and no database install needed.

```bash
git clone https://github.com/nehayadav827/bawarchi-direct.git
cd bawarchi-direct
npm install
npm run dev          # http://localhost:3000
```

On first start the app creates an embedded Postgres (PGlite) in `.data/`, runs the migration and seeds the demo data. Delete `.data/` to reset.

Other commands:

```bash
npm test             # 52 unit and integration tests
npm run typecheck
BASE=http://localhost:3000 bash scripts/smoke.sh   # 29 end-to-end checks against a running server
```

To use a real Postgres locally, set `DATABASE_URL=postgres://user:pass@host:5432/dbname` before `npm run dev`. The migration runs automatically at start-up.

## How it is deployed

One container (see `Dockerfile`: Next.js standalone output on Node 22) plus one Postgres database. The app runs its migration and, when `SEED_DEMO=true`, seeds demo data at start-up. Seeding is idempotent, so restarts are safe. `GET /api/health` checks the database and is used as the health check.

Any host that runs a Docker image and gives you a Postgres URL works. Steps for Render with a free Postgres (Neon or Supabase work the same way):

1. Create a Postgres database and copy its connection string.
2. Create a **Web Service** from the GitHub repo, runtime **Docker**, health check path `/api/health`.
3. Add the environment variables below and deploy.
4. Open the service URL and sign in with a demo account.

The live kitchen feed uses Server-Sent Events (a long-lived HTTP response). Use a host that does not buffer or time out streaming responses. If the stream is blocked, the kitchen display falls back to refreshing every 10 seconds and shows "Reconnecting".

## Environment variables (names only)

| Name | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes in production | Postgres connection string. If unset, the app uses the embedded database in `.data/` (local only) |
| `AUTH_SECRET` | Yes in production | Long random string that signs session cookies. The app refuses to start in production without it |
| `SEED_DEMO` | For the reviewer demo | Set to `true` to seed demo data and accounts. Leave unset for a real launch |
| `PORT` | Set by most hosts | HTTP port, default 3000 |

Generate a secret with `openssl rand -base64 48`. No secrets are stored in the repository: `.env.example` lists names only.

## Security notes

Passwords are hashed with bcrypt. Sessions are signed, HTTP-only cookies. Every API route checks the role, and kitchen staff are limited to their own outlet. Inputs are validated with zod. Prices are always recalculated on the server. Login, sign-up and ordering are rate limited per instance. Demo accounts and the demo password exist only for review: do not seed them in a real launch.
