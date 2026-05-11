# Quik Inspect API (Hono)

Neon PostgreSQL + JWT. Lives in the **monorepo** under `server/`.

## Local dev

```bash
npm install
npm run dev
```

Uses `src/dev-server.ts` (Node HTTP). **Vercel** uses `src/index.ts` (`export default app`) — [official Hono on Vercel](https://vercel.com/docs/frameworks/backend/hono).

## Vercel

| Setting | Value |
|--------|--------|
| **Root directory** (if monorepo) | `server` |
| **Framework preset** | **Hono** (recommended) or **Other** |
| **Output directory** | *(empty)* |
| **Build command** | *(leave default; `vercel.json` sets `npm run build`)* |

Env: see `.env.example` (`DATABASE_URL`, `JWT_SECRET`, …).

## DB

```bash
npm run db:migrate
```
