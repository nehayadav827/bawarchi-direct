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

Five more demo customers exist (`customer2@demo.test` to `customer6@demo.test`). Other outlets follow the same pattern: `kitchen.<outlet>@demo.test` and `manager.<outlet>@demo.test` with outlet ids `gachibowli-ck`, `kukatpally`, `banjara-hills`.

Test payments: card `4111 1111 1111 1111`, UPI `demo@okbank`. Use `fail@test` (UPI) or `4000 0000 0000 0002` (card) to see a decline. Nothing is charged.

Suggested walkthrough (about 5 minutes):

1. Sign in as the customer. The home page offers outlets and a party order link. Open Kondapur: the menu shows an "Order again" row built from the customer's history (suggestions only, nothing is added for you).
2. Add items and check out. The demo customer already has reward points: tick "Use my points" and see the price drop. Pay with the test card or UPI. Tracking opens, with simulated WhatsApp messages at the bottom. While the order is still "Received" you can cancel it, which returns the points.
3. In a second window sign in as `manager.kondapur@demo.test`. The new order is on the kitchen board with a timer. Move it through Start cooking, Mark ready, Handed to rider. The customer page updates. Use "Change time" to override the promised time, and "Out of stock" to pause an item.
4. The seeded Kukatpally order starts 4 minutes late. Sign in as `manager.kukatpally@demo.test`: it shows red, and once it is 10 minutes late a banner and a customer message appear (the server checks every 30 seconds, even with no kitchen screen open).
5. As the customer open **Party orders** and send a request (at least 48 hours ahead). As `manager.kondapur@demo.test` open Kitchen, then Party orders, and confirm it with a price. The customer sees the answer.
6. As the manager or admin open **Dashboard**: orders, prep time, on-time rate, cancellations and repeat customers per outlet. Admin also edits the central menu.

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
npm test             # 71 unit and integration tests
npm run typecheck
BASE=http://localhost:3000 bash scripts/smoke.sh   # 49 end-to-end checks against a running server
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
| `AUTH_SECRET` | Yes in production | Long random string that signs session cookies. In production, sign-in fails and `/api/health` reports unhealthy if it is missing |
| `SEED_DEMO` | For the reviewer demo | Set to `true` to seed demo data and accounts. Leave unset for a real launch |
| `SWEEP_INTERVAL_MS` | No | How often the late-order alert check runs, default 30000 |
| `PORT` | Set by most hosts | HTTP port, default 3000 |

Generate a secret with `openssl rand -base64 48`. No secrets are stored in the repository: `.env.example` lists names only.

## Security notes

Passwords are hashed with bcrypt. Sessions are signed, HTTP-only cookies. Every API route checks the role, and kitchen staff are limited to their own outlet. Inputs are validated with zod. Prices are always recalculated on the server. Login, sign-up and ordering are rate limited per instance. Demo accounts and the demo password exist only for review: do not seed them in a real launch.
