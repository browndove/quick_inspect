import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let _sql: NeonQueryFunction<false, false> | null = null;

/**
 * Neon dashboard strings sometimes include `channel_binding=require`, which can
 * hang or misbehave with the serverless HTTP driver on Vercel — strip it.
 */
function normalizeDatabaseUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.searchParams.delete('channel_binding');
    let s = u.toString();
    if (s.endsWith('?')) s = s.slice(0, -1);
    return s;
  } catch {
    return raw
      .replace(/[?&]channel_binding=require\b/gi, '')
      .replace(/\?&/g, '?')
      .replace(/&&+/g, '&')
      .replace(/[?&]$/g, '');
  }
}

export function getSql(): NeonQueryFunction<false, false> {
  if (_sql) return _sql;
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is not set');
  const url = normalizeDatabaseUrl(raw.trim());
  _sql = neon(url, {
    fetchOptions: { cache: 'no-store' },
  });
  return _sql;
}
