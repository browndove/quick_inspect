# Quik Inspect (monorepo)

| Folder   | What it is |
|----------|------------|
| `PC/`    | Expo app (React Native) |
| `server/` | Express API (Node 20), deploys to Vercel |

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

**Recommended:** set **Root Directory** to **`server`** (not the repo root). Then Vercel reads **`server/vercel.json`** and builds the API; the serverless entry is **`server/src/index.ts`** (`export default` = Express via **`serverless-http`**).

If you leave Root Directory as **`.`** (repo root), the root **`vercel.json`** runs `npm install` / `npm run build` inside **`server/`** only — set the framework to **Other** so **`server/src/index.ts`** is used as the function entry (do **not** use the **Hono** preset).

1. Connect this repository to Vercel.
2. **Root Directory:** **`server`** (recommended).
3. **Framework preset:** **Other** (this API is **Express**, not Hono).
4. **Output directory:** leave this **empty / default** in the Vercel dashboard and **do not** set **`outputDirectory`** to **`public`** in **`vercel.json`**. Treating **`public`** as the deployment output directory makes Vercel ship **static files only**, so the Express app is never invoked and paths like **`/health`** return **`404 NOT_FOUND`**. Optional static files live in **`server/public/`**; **`npm run build`** runs **`postbuild`** so that folder always exists after compile.
5. **Environment variables:** `DATABASE_URL`, `JWT_SECRET`, … (`server/.env.example`).

**Do not** add a `functions` pattern in `vercel.json` unless it matches files **relative to the Root Directory** — otherwise you get `doesn't match any` build errors.

Production entry: **`server/src/index.ts`** (`export default` serverless handler).

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
