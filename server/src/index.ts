/**
 * Vercel serverless entry — Express wrapped for the Node runtime.
 */
import serverless from 'serverless-http';
import { app } from './http-app.js';

export default serverless(app);
