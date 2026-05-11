/**
 * Vercel entrypoint — official Hono on Vercel shape (`export default app`).
 * @see https://vercel.com/docs/frameworks/backend/hono
 *
 * Local dev: `npm run dev` uses `src/dev-server.ts` instead.
 */
import { app } from './http-app.js';

export default app;
