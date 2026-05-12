# Production checklist — Quik Inspect

## API (FastAPI in `backend/` — recommended)

1. **Neon** — Create a database; copy the **pooler** connection string into hosting env as `DATABASE_URL` (Railway, Vercel, etc.).
2. **Secrets** — Set `JWT_SECRET` to a long random string (`openssl rand -base64 32`).
3. **Migrations** — Run against production DB:
   - `cd backend && export DATABASE_URL="…" && npm run db:migrate:backend`  
   - (or `python3 backend/scripts/migrate.py` with `DATABASE_URL` set)
4. **Railway** (typical production)
   - Connect repo (e.g. **`browndove/PC-server`** with `backend/` subtree, or this monorepo with root `backend/`).
   - Set **`DATABASE_URL`**, **`JWT_SECRET`**, optional **`JWT_EXPIRES_IN`**, **`CORS_ORIGIN`**.
   - **`railpack.json`** / **`Procfile`** supply `uvicorn main:app` (see **`backend/README.md`**).
5. **Vercel** (optional) — **Root Directory** `backend`, framework **FastAPI**, same env vars; **`[tool.vercel]`** in `backend/pyproject.toml`.
6. **Smoke test** — `GET /health` and `POST /auth/login` against the deployed URL (e.g. `https://pc-server-production.up.railway.app`).

## Legacy API (Express in `server/`)

Same Neon/JWT steps; migrations: `cd server && DATABASE_URL="…" npm run db:migrate`; Vercel **Root Directory** `server`, framework **Other**.

## Mobile app (`PC/`)

1. **API URL** — Set `EXPO_PUBLIC_API_URL` to the **HTTPS** API origin (no trailing slash). **`PC/eas.json`** bakes Railway production into **preview** and **production** builds; override in **EAS → Secrets** if needed. For local dev, use **`PC/.env`** (not committed).
2. **Identifiers** — Replace defaults in `app.config.ts` / EAS env: `IOS_BUNDLE_ID`, `ANDROID_PACKAGE` (reverse-DNS you own).
3. **EAS** — `cd PC && npx eas-cli@latest init` (once), then `eas build --profile production`.
4. **Stores** — `eas submit` when binaries are ready; complete App Store / Play Console metadata.

## Security notes

- Never commit `.env` files with real secrets.
- `EXPO_PUBLIC_*` values are visible inside the client app; only put the public API base URL there, not database or JWT material.
