# Quik Inspect (monorepo)

| Folder   | What it is |
|----------|------------|
| `PC/`    | Expo app (React Native) |
| `server/` | Hono API (Node 20), deploys to Vercel |

## Install

```bash
npm run install:all
```

Or install each package: `cd PC && npm i` and `cd server && npm i`.

## Dev

```bash
npm run dev:pc      # Expo / Metro
npm run dev:server  # Local API (tsx)
```

## Vercel (API)

1. Connect this **single repository** to Vercel.
2. **Settings → General → Root Directory:** **`server`** (required for this monorepo).
3. **Framework preset:** **Hono** (matches `src/index.ts` → `export default app`) or **Other**.
4. **Output directory:** leave **empty** (do not set `public` or `dist`).
5. **Environment variables:** `DATABASE_URL`, `JWT_SECRET`, etc. (see `server/.env.example`).

The API entry for production is **`server/src/index.ts`** (Vercel’s supported Hono shape — no `api/` folder or rewrites).

## GitHub

This repo replaces separate `PC` + `PC-server` remotes. After pushing here, point Vercel and EAS at this repo (Vercel root = `server`).

Former remotes (for history / cherry-pick if needed):

- App: `https://github.com/browndove/PC.git`
- API: `https://github.com/browndove/PC-server.git`

## First push (new GitHub repo)

Create an empty repo (e.g. `quik-inspect`), then:

```bash
cd /path/to/quik_inspect
git remote add origin https://github.com/ORG/quik-inspect.git
git push -u origin main
```

Then in **Vercel** → link that repo → **Root Directory** = `server` → redeploy.
