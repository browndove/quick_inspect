/**
 * Run migrations/*.sql in order against DATABASE_URL.
 * Uses `postgres` for multi-statement files (Neon-compatible).
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dir = path.join(root, 'migrations');

/** Same idea as `src/db.ts` — Neon sometimes appends `channel_binding=require`, which can break some clients. */
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

function resolveDatabaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (raw == null || String(raw).trim() === '') {
    console.error('DATABASE_URL is not set.');
    console.error('Fix: copy your Neon connection string into server/.env, or run:');
    console.error('  DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxxx.region.aws.neon.tech/neondb?sslmode=require" npm run db:migrate');
    console.error('Source: Neon Dashboard → Connect, or Vercel → Project → Settings → Environment Variables.');
    process.exit(1);
  }
  const url = String(raw).trim();
  if (
    /…/u.test(url) ||
    /\b(same\s+URL|same\s+url|as\s+Vercel)\b/i.test(url) ||
    /\b(your-neon|YOUR_NEON|paste-here)\b/i.test(url)
  ) {
    console.error('DATABASE_URL still looks like instructions, not a real URL (found "…" or placeholder words).');
    console.error('Paste the full string from Neon (starts with postgresql://) — do not type ellipses or prose.');
    process.exit(1);
  }
  if (/^postgresql:\/\/USER:PASSWORD@HOST\b/i.test(url) || /@HOST\//i.test(url)) {
    console.error('DATABASE_URL matches the .env.example template — replace USER, PASSWORD, and HOST with your Neon values.');
    process.exit(1);
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    console.error('DATABASE_URL is not a valid URL (check for spaces, missing https→postgresql, or stray quotes).');
    console.error('Example shape: postgresql://name:secret@ep-abc-123.us-east-2.aws.neon.tech/neondb?sslmode=require');
    process.exit(1);
  }
  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    console.error(`DATABASE_URL must start with postgresql:// or postgres:// (got protocol: ${parsed.protocol}).`);
    process.exit(1);
  }
  return normalizeDatabaseUrl(url);
}

const url = resolveDatabaseUrl();

const sql = postgres(url, { max: 1 });

const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

for (const file of files) {
  const full = path.join(dir, file);
  const body = fs.readFileSync(full, 'utf8');
  console.log('→', file);
  await sql.unsafe(body);
}

await sql.end();
console.log('Migrations finished.');
