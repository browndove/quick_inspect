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

**Recommended:** set **Root Directory** to **`server`** (not the repo root). Then Vercel reads **`server/vercel.json`** only, discovers **`src/index.ts`** → `export default app`, and the **Hono** preset works.

If you leave Root Directory as **`.`** (repo root), the root **`vercel.json`** runs `npm install` / `npm run build` inside **`server/`** only — but you must still pick **Hono** or **Other** so the entry file is detected under **`server/src/index.ts`**.

1. Connect this repository to Vercel.
2. **Root Directory:** **`server`** (recommended).
3. **Framework preset:** **Hono** or **Other**.
4. **Output directory:** if Vercel requires **`public`** (common error: *No Output Directory named "public" found*), keep **`outputDirectory`: `"public"`** in **`vercel.json`** and use the repo’s **`public/`** / **`server/public/`** with **only non-`index.html` files** (e.g. **`robots.txt`**). A root **`index.html`** in `public` can make **`/health`** return static HTML instead of Hono JSON.
5. **Environment variables:** `DATABASE_URL`, `JWT_SECRET`, … (`server/.env.example`).

**Do not** add a `functions` pattern in `vercel.json` unless it matches files **relative to the Root Directory** — otherwise you get `doesn't match any` build errors.

Production entry: **`server/src/index.ts`** (`export default app`).

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
