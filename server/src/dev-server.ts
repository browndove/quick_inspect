/**
 * Local development only — Node HTTP server (@hono/node-server).
 * Vercel uses `src/index.ts` (default export of the Hono app).
 */
import 'dotenv/config';
import { serve } from '@hono/node-server';
import { app } from './http-app.js';

const port = Number(process.env.PORT) || 3000;
const hostname = process.env.HOST ?? '0.0.0.0';

serve({ fetch: app.fetch, port, hostname }, (info) => {
  const p =
    info && typeof info === 'object' && 'port' in info ? (info as { port: number }).port : port;
  console.log(`Listening on http://${hostname}:${p}`);
  console.log(`From a phone: http://<this-machine-LAN-IP>:${p} (same Wi‑Fi; matches EXPO_PUBLIC_API_URL)`);
});
