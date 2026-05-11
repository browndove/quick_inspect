import { Router } from 'express';
import { z } from 'zod';
import { getSql } from '../db.js';
import { signAccessToken } from '../lib/jwt.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { requireAuth } from '../middleware/auth.js';
import {
  errorMessageChain,
  looksLikeDbTransportFailure,
  looksLikeMissingRelation,
  looksLikeUniqueViolation,
  postgresErrorCode,
} from '../pg-error.js';

function firstRowId(rows: unknown): string | undefined {
  if (!Array.isArray(rows) || rows.length === 0) return undefined;
  const row = rows[0] as Record<string, unknown>;
  const v = row.id ?? row.ID;
  if (typeof v === 'string' && v.length > 0) return v;
  if (v != null && (typeof v === 'number' || typeof v === 'boolean')) return String(v);
  if (v != null && typeof v === 'object' && 'toString' in v && typeof (v as { toString: () => string }).toString === 'function') {
    const s = String((v as { toString: () => string }).toString());
    if (s && s !== '[object Object]') return s;
  }
  return undefined;
}

const signupBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const profileBody = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional(),
});

const signatureBody = z.object({
  signatureUrl: z.string().url(),
});

export const authRouter = Router();

authRouter.get('/login', (_req, res) => {
  res.status(405).json({
    error: 'Method not allowed',
    hint: 'Use POST with JSON body: { "email": "…", "password": "…" } (e.g. curl or the mobile app).',
  });
});

authRouter.post('/signup', async (req, res) => {
  if (!process.env.JWT_SECRET?.trim()) {
    res.status(503).json({ error: 'Server is misconfigured (missing JWT secret).' });
    return;
  }

  const sql = getSql();
  const parsed = signupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }
  const { email, password, firstName, lastName } = parsed.data;
  try {
    const passwordHash = await hashPassword(password);
    const rows = await sql`
      insert into inspectors (email, password_hash, first_name, last_name)
      values (${email.toLowerCase()}, ${passwordHash}, ${firstName}, ${lastName})
      returning id
    `;
    const id = firstRowId(rows);
    if (!id) {
      console.error('signup insert returned no id', {
        rowCount: Array.isArray(rows) ? rows.length : 'n/a',
        sample: rows,
      });
      res.status(500).json({
        error: 'Account was not saved correctly. Redeploy the API or run database migrations.',
      });
      return;
    }
    const token = signAccessToken({ sub: id, email: email.toLowerCase() });
    res.status(201).json({
      token,
      inspector: {
        id,
        email: email.toLowerCase(),
        firstName,
        lastName,
      },
    });
  } catch (e: unknown) {
    const code = postgresErrorCode(e);
    const chain = errorMessageChain(e);

    if (code === '23505' || looksLikeUniqueViolation(e)) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
    if (code === '42P01' || looksLikeMissingRelation(e)) {
      res.status(503).json({
        error:
          'Database not initialized. From the API project run: npm run db:migrate (with DATABASE_URL set to your Neon DB).',
      });
      return;
    }
    if (code === '42703') {
      res.status(503).json({
        error:
          'Database schema is out of date. Run npm run db:migrate against the database used by Vercel.',
      });
      return;
    }
    if (looksLikeDbTransportFailure(e)) {
      res.status(503).json({
        error:
          'API cannot reach the database. On Vercel, open the project → Settings → Environment Variables and fix DATABASE_URL (Neon connection string).',
      });
      return;
    }
    if (chain.includes('password authentication failed')) {
      res.status(503).json({
        error: 'Database URL password is wrong. Update DATABASE_URL in the server environment.',
      });
      return;
    }
    if (chain.includes('JWT_SECRET') || /secret.*jwt|jwt.*secret|secretOrPrivateKey/i.test(chain)) {
      res.status(503).json({
        error: 'Server cannot sign login tokens. Set a strong JWT_SECRET on Vercel (e.g. openssl rand -base64 32).',
      });
      return;
    }
    if (/bcrypt|hash.*password|password.*hash/i.test(chain)) {
      res.status(500).json({ error: 'Could not secure your password. Try again in a moment.' });
      return;
    }

    console.error('signup error', chain, e);
    const suffix = code ? ` (database code ${code})` : '';
    res.status(500).json({
      error: `Could not create account${suffix}. Check Vercel → this deployment → Logs, or confirm DATABASE_URL on Vercel matches the Neon DB you migrated.`,
    });
  }
});

authRouter.post('/login', async (req, res) => {
  const sql = getSql();
  const parsed = loginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }
  const { email, password } = parsed.data;
  const rows = (await sql`
    select id, password_hash, first_name, last_name
    from inspectors
    where email = ${email.toLowerCase()}
    limit 1
  `) as {
    id: string;
    password_hash: string;
    first_name: string;
    last_name: string;
  }[];
  const row = rows[0];
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }
  const token = signAccessToken({
    sub: row.id,
    email: email.toLowerCase(),
  });
  res.json({
    token,
    inspector: {
      id: row.id,
      email: email.toLowerCase(),
      firstName: row.first_name,
      lastName: row.last_name,
    },
  });
});

authRouter.get('/me', requireAuth, async (_req, res) => {
  const sql = getSql();
  const inspectorId = res.locals.inspectorId;
  const rows = (await sql`
    select id, email, first_name, last_name, phone, signature_url, created_at
    from inspectors
    where id = ${inspectorId}::uuid
    limit 1
  `) as {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    signature_url: string | null;
    created_at: string;
  }[];
  const row = rows[0];
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    signatureUrl: row.signature_url,
    createdAt: row.created_at,
  });
});

authRouter.put('/profile', requireAuth, async (req, res, next) => {
  const sql = getSql();
  const inspectorId = res.locals.inspectorId;
  const parsed = profileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }
  const b = parsed.data;
  const cur = (await sql`
    select id, email, first_name, last_name, phone
    from inspectors
    where id = ${inspectorId}::uuid
    limit 1
  `) as {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    phone: string | null;
  }[];
  if (!cur[0]) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const firstName = b.firstName ?? cur[0].first_name;
  const lastName = b.lastName ?? cur[0].last_name;
  const phone = b.phone !== undefined ? b.phone : cur[0].phone;
  const email = b.email?.toLowerCase() ?? cur[0].email;
  try {
    const rows = (await sql`
      update inspectors
      set
        first_name = ${firstName},
        last_name = ${lastName},
        phone = ${phone},
        email = ${email},
        updated_at = now()
      where id = ${inspectorId}::uuid
      returning id, email, first_name, last_name, phone
    `) as {
      id: string;
      email: string;
      first_name: string;
      last_name: string;
      phone: string | null;
    }[];
    const row = rows[0];
    if (!row) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone,
    });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === '23505') {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }
    next(e);
  }
});

authRouter.put('/signature', requireAuth, async (req, res) => {
  const sql = getSql();
  const inspectorId = res.locals.inspectorId;
  const parsed = signatureBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }
  const { signatureUrl } = parsed.data;
  const rows = (await sql`
    update inspectors
    set signature_url = ${signatureUrl}, updated_at = now()
    where id = ${inspectorId}::uuid
    returning id, signature_url
  `) as { id: string; signature_url: string }[];
  const row = rows[0];
  if (!row) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({ id: row.id, signatureUrl: row.signature_url });
});
