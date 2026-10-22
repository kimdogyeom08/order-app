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

Configure the existing `.env` file with either all of `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and `PGPASSWORD`, or a `DATABASE_URL` PostgreSQL connection string. When all five `PG*` settings are present, they take precedence over `DATABASE_URL`. The `.env` file is ignored by Git and must not be committed.

## Run

```powershell
npm run dev
```

The server listens on port `3000` by default. Set `PORT` or the comma-separated `FRONTEND_ORIGINS` in `.env` to override the defaults.

## Health checks

- `GET /api/health` checks that the HTTP API is running.
- `GET /api/health/db` checks the PostgreSQL connection and returns `503` if the database is unavailable.

## Tests

```powershell
npm test
```
