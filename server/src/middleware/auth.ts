import type { Context, Next } from 'hono';
import { verifyAccessToken } from '../lib/jwt.js';

export async function requireAuth(c: Context, next: Next) {
  const header = c.req.header('authorization');
  if (!header?.toLowerCase().startsWith('bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }
  const token = header.slice(7).trim();
  if (!token) {
    return c.json({ error: 'Missing token' }, 401);
  }
  try {
    const { sub, email } = verifyAccessToken(token);
    c.set('inspectorId', sub);
    c.set('inspectorEmail', email);
    await next();
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
}
