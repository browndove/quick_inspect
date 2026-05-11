# Quik Inspect API (Express)

Neon PostgreSQL + JWT. Lives in the **monorepo** under `server/`.

## Local dev

```bash
npm install
npm run dev
```

Uses `src/dev-server.ts` (plain `app.listen`). **Vercel** uses `src/index.ts` — default export is the app wrapped with [`serverless-http`](https://github.com/dougmoscrop/serverless-http) for the Node serverless runtime.

## Vercel

| Setting | Value |
|--------|--------|
| **Root directory** (if monorepo) | `server` |
| **Framework preset** | **Other** (recommended) — avoid **Hono**; this project is Express. |
| **Output directory** | *(empty)* |
| **Build command** | *(leave default; `vercel.json` sets `npm run build`)* |

Env: see `.env.example` (`DATABASE_URL`, `JWT_SECRET`, …).

## DB

```bash
npm run db:migrate
```
