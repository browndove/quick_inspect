import { handle } from 'hono/vercel';
import { app } from '../src/http-app.js';

/**
 * Vercel expects `export default { fetch(request) { ... } }` for the Web
 * Handler shape — a bare `export default handle(app)` function can crash.
 * @see https://vercel.com/docs/functions/functions-api-reference
 */
export const config = {
  maxDuration: 25,
};

export default {
  fetch: handle(app),
};
