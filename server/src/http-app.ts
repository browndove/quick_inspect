/**
 * Hono application instance.
 *
 * File is intentionally **not** named `app.ts` — Vercel can mis-detect `src/app.*`
 * as a Next.js App Router entry and try to run it as a standalone serverless
 * function ("default export must be a function").
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getSql } from './db.js';
import { errorMessageChain, looksLikeDbTransportFailure, postgresErrorCode } from './pg-error.js';
import { auth } from './routes/auth.js';
import { checklists } from './routes/checklists.js';
import { facilities } from './routes/facilities.js';
import { inspections } from './routes/inspections.js';

/**
 * CORS: optional `CORS_ORIGIN` = comma-separated web origins (e.g. `https://app.example.com`).
 * If unset or `*`, all origins are allowed (typical while Expo native has no `Origin` header).
 * For a browser-only web client in production, set an explicit list and drop `*`.
 */
function corsOrigin(): string | ((origin: string | undefined) => string | undefined | null) {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (!raw || raw === '*') return '*';
  const allowed = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (allowed.length === 0) return '*';
  return (origin) => {
    if (!origin) return '*';
    return allowed.includes(origin) ? origin : undefined;
  };
}

export const app = new Hono();

app.use(
  '*',
  cors({
    origin: corsOrigin(),
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);

app.get('/health', async (c) => {
  const base = {
    ok: true,
    runtime: process.env.VERCEL ? 'vercel' : 'node',
    env: process.env.NODE_ENV ?? 'development',
    time: new Date().toISOString(),
    database: {
      reachable: false,
      inspectorsTable: false,
      /** Set when reachable is false — safe to show in dashboard; no secrets. */
      hint: null as string | null,
    },
  };

  try {
    if (!process.env.DATABASE_URL?.trim()) {
      base.database.hint = 'DATABASE_URL is not set on this deployment.';
      return c.json(base);
    }
    const sql = getSql();
    await sql`select 1 as ping`;
    base.database.reachable = true;
    const reg = await sql`select to_regclass('public.inspectors') is not null as ready`;
    base.database.inspectorsTable = Boolean((reg as { ready: boolean }[])[0]?.ready);
    if (!base.database.inspectorsTable) {
      base.database.hint =
        'Connected, but table public.inspectors is missing — run npm run db:migrate in server/ against this DATABASE_URL.';
    }
  } catch (e) {
    const code = postgresErrorCode(e);
    const chain = errorMessageChain(e);
    if (code === '42P01') {
      base.database.hint = 'Relation missing (run migrations).';
    } else if (looksLikeDbTransportFailure(e)) {
      base.database.hint = 'Cannot reach Neon (check DATABASE_URL host / network).';
    } else if (chain.toLowerCase().includes('password authentication failed')) {
      base.database.hint = 'Database rejected credentials (wrong password in URL).';
    } else {
      base.database.hint = 'Database check failed — see server logs.';
    }
    console.error('health db check', chain);
  }

  return c.json(base);
});

/** Quiet browser probes so deployment logs stay clean. */
app.get('/favicon.ico', () => new Response(null, { status: 204 }));
app.get('/favicon.png', () => new Response(null, { status: 204 }));

app.route('/auth', auth);
app.route('/facilities', facilities);
app.route('/inspections', inspections);
app.route('/checklists', checklists);

app.onError((err, c) => {
  console.error(err);
  if (process.env.NODE_ENV !== 'production') {
    return c.json({ error: err.message }, 500);
  }
  return c.json({ error: 'Internal server error' }, 500);
});

app.notFound((c) => c.json({ error: 'Not found' }, 404));
