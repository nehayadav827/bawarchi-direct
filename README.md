# bawarchi-direct

Direct ordering web app, central menu admin and outlet kitchen display for a fictional Hyderabad biryani chain ("Company A"). Built as a take-home against a client brief.

All outlets, menu items, FSSAI numbers and customers are fictional sample data.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000, seeded demo data, embedded Postgres (PGlite), no Docker needed
npm test           # unit and integration tests
npm run build && SEED_DEMO=true AUTH_SECRET=local-secret npm start   # production build
BASE=http://localhost:3000 bash scripts/smoke.sh                     # end-to-end smoke test
```

Demo accounts (fictional, password `Demo@1234`): `customer@demo.test`, `kitchen.kondapur@demo.test`, `manager.kondapur@demo.test`, `admin@demo.test`.

Set `DATABASE_URL` to use a hosted Postgres instead of the embedded one.

## Layout

- `src/domain`: pure logic (GST pricing, order state machine, prep-time estimate, delivery radius). No I/O.
- `src/server`: services (checkout, kitchen actions, menu, auth) that talk to the database.
- `src/db`: Drizzle schema, migration, seed. `drizzle/` holds the SQL migration.
- `src/app`: Next.js screens and API routes. The live kitchen feed is `api/kitchen/[outletId]/stream` (Server-Sent Events).
