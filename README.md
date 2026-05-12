# Quik Inspect (monorepo)

| Folder   | What it is |
|----------|------------|
| `PC/`    | Expo app (React Native) |
| `backend/` | **FastAPI** API (Python 3.11+), Neon — **recommended** backend |
| `server/` | Legacy **Express** API (Node 20); optional if you standardize on `backend/` |

## Install

```bash
npm run install:all
```

Or install each package: `cd PC && npm i`, `cd server && npm i`, and the Python API:

```bash
cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
```

## Dev

```bash
npm run dev:pc       # Expo / Metro
npm run dev:backend  # FastAPI (uvicorn), port 3000
npm run dev:server   # Legacy Express (tsx), port 3000
```

## Vercel (API)

### FastAPI (`backend/`) — recommended

1. **Root Directory:** **`backend`**
2. **Framework preset:** **FastAPI** (see [Vercel FastAPI](https://vercel.com/docs/frameworks/backend/fastapi); `pyproject.toml` sets **`[tool.vercel] entrypoint = "app.main:app"`**).
3. **Output directory:** leave **empty** (do not use `public` as the only deployment output).
4. **Environment variables:** `DATABASE_URL`, `JWT_SECRET`, optional `JWT_EXPIRES_IN`, `CORS_ORIGIN` — see **`backend/.env.example`**.

### Legacy Express (`server/`)

1. **Root Directory:** **`server`**
2. **Framework preset:** **Other**
3. **Output directory:** empty; env vars as in **`server/.env.example`**.

Production entry (Express): **`server/src/index.ts`**. Production entry (FastAPI): **`app.main:app`** inside **`backend/`**.

## GitHub

This repo replaces separate `PC` + `PC-server` remotes. After pushing here, point Vercel and EAS at this repo (Vercel root = **`backend`** for the Python API, or **`server`** if you still deploy Express).

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
