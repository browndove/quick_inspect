/**
 * Express application. File is **not** named `app.ts` — Vercel can mis-detect
 * `src/app.*` as a Next.js App Router entry.
 */
import cors from 'cors';
import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import 'express-async-errors';
import { getSql } from './db.js';
import { errorMessageChain, looksLikeDbTransportFailure, postgresErrorCode } from './pg-error.js';
import { authRouter } from './routes/auth.js';
import { checklistsRouter } from './routes/checklists.js';
import { facilitiesRouter } from './routes/facilities.js';
import { inspectionsRouter } from './routes/inspections.js';

function corsOriginDelegate(): (
  origin: string | undefined,
  cb: (err: Error | null, allow?: boolean) => void,
) => void {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (!raw || raw === '*') {
    return (_origin, cb) => cb(null, true);
  }
  const allowed = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (allowed.length === 0) {
    return (_origin, cb) => cb(null, true);
  }
  return (origin, cb) => {
    if (!origin) {
      cb(null, true);
      return;
    }
    cb(null, allowed.includes(origin));
  };
}

export const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(
  cors({
    origin: corsOriginDelegate(),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

const healthHandler: RequestHandler = async (_req, res) => {
  const base = {
    ok: true,
    runtime: process.env.VERCEL ? 'vercel' : 'node',
    env: process.env.NODE_ENV ?? 'development',
    time: new Date().toISOString(),
    database: {
      reachable: false,
      inspectorsTable: false,
      hint: null as string | null,
    },
  };

  try {
    if (!process.env.DATABASE_URL?.trim()) {
      base.database.hint = 'DATABASE_URL is not set on this deployment.';
      res.json(base);
      return;
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

  res.json(base);
};

app.get('/health', healthHandler);
app.get('/favicon.ico', (_req, res) => res.status(204).end());
app.get('/favicon.png', (_req, res) => res.status(204).end());

app.use('/auth', authRouter);
app.use('/facilities', facilitiesRouter);
app.use('/inspections', inspectionsRouter);
app.use('/checklists', checklistsRouter);

const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Not found' });
};
app.use(notFound);

const onError: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  if (process.env.NODE_ENV !== 'production') {
    res.status(500).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Internal server error' });
};
app.use(onError);
