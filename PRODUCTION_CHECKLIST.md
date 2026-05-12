# Production checklist — Quik Inspect

## API (FastAPI in `backend/` — recommended)

1. **Neon** — Create a database; copy the **pooler** connection string into Vercel env as `DATABASE_URL`.
2. **Secrets** — Set `JWT_SECRET` to a long random string (`openssl rand -base64 32`).
3. **Migrations** — Run against production DB:
   - `cd backend && export DATABASE_URL="…" && npm run db:migrate:backend`  
   - (or `python3 backend/scripts/migrate.py` with `DATABASE_URL` set)
4. **Vercel**
   - **Root Directory**: `backend`
   - **Framework**: **FastAPI**
   - **Environment variables**: `DATABASE_URL`, `JWT_SECRET`, optional `JWT_EXPIRES_IN`, optional `CORS_ORIGIN`.
5. **Smoke test** — `GET /health` and `POST /auth/login` against the deployed URL.

## Legacy API (Express in `server/`)

Same Neon/JWT steps; migrations: `cd server && DATABASE_URL="…" npm run db:migrate`; Vercel **Root Directory** `server`, framework **Other**.

## Mobile app (`PC/`)

1. **API URL** — In EAS (or your CI), set `EXPO_PUBLIC_API_URL` to the **HTTPS** API origin (no trailing slash), then run a production build so it is baked into the binary.
2. **Identifiers** — Replace defaults in `app.config.ts` / EAS env: `IOS_BUNDLE_ID`, `ANDROID_PACKAGE` (reverse-DNS you own).
3. **EAS** — `cd PC && npx eas-cli@latest init` (once), then `eas build --profile production`.
4. **Stores** — `eas submit` when binaries are ready; complete App Store / Play Console metadata.

## Security notes

- Never commit `.env` files with real secrets.
- `EXPO_PUBLIC_*` values are visible inside the client app; only put the public API base URL there, not database or JWT material.
