# COZY API Server

Express API server for the COZY coffee ordering app. The server uses PostgreSQL through `pg` and keeps its package configuration separate from the React app in `ui/`.

## Requirements

- Node.js 20 or later
- PostgreSQL for database-backed endpoints

## Setup

```powershell
cd server
npm install
```

Configure the existing `.env` file with either all of `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and `PGPASSWORD`, or a `DATABASE_URL` PostgreSQL connection string. Locally, complete `PG*` settings take precedence over `DATABASE_URL`. On Render, `DATABASE_URL` takes precedence and TLS is enabled for Render Postgres's self-signed internal certificate. Use the database's Internal Database URL for a service in the same region. The `.env` file is ignored by Git and must not be committed.

The server creates the required tables and inserts the initial coffee menu and options on startup. Existing menu stock and orders are preserved across restarts.

## Run

```powershell
npm run dev
```

The server listens on port `3000` by default. Set `PORT` or the comma-separated `FRONTEND_ORIGINS` in `.env` to override the defaults.

## Health checks

- `GET /api/health` checks that the HTTP API is running.
- `GET /api/health/db` checks the PostgreSQL connection and returns `503` if the database is unavailable.

## API

- `GET /api/menus` returns available menus and options.
- `POST /api/orders` creates an order. Send an `Idempotency-Key` header to safely retry a submission.
- `GET /api/orders/:orderId` returns an order snapshot.
- `GET /api/admin/menus` and `PATCH /api/admin/menus/:menuId/stock` read and adjust stock.
- `GET /api/admin/orders` and `PATCH /api/admin/orders/:orderId/status` manage orders.

The Vite development server proxies `/api` to `http://localhost:3000`.

## Tests

```powershell
npm test
```
