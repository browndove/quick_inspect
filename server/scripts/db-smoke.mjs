/**
 * One-off: verify Neon + inspectors table (no secrets printed).
 * Usage: node scripts/db-smoke.mjs
 */
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

function normalizeDatabaseUrl(raw) {
  try {
    const u = new URL(raw);
    u.searchParams.delete('channel_binding');
    let s = u.toString();
    if (s.endsWith('?')) s = s.slice(0, -1);
    return s;
  } catch {
    return raw;
  }
}

const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error('DATABASE_URL missing');
  process.exit(1);
}

const sql = neon(normalizeDatabaseUrl(raw.trim()), {
  fetchOptions: { cache: 'no-store' },
});

const reg = await sql`select to_regclass('public.inspectors') as reg`;
console.log('inspectors table:', reg[0]?.reg ?? reg);

const one = await sql`select 1 as n`;
console.log('select 1 shape:', one, 'array?', Array.isArray(one));
