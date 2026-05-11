import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { verifyAccessToken } from '../lib/jwt.js';

export const requireAuth: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.toLowerCase().startsWith('bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }
  const token = header.slice(7).trim();
  if (!token) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }
  try {
    const { sub, email } = verifyAccessToken(token);
    res.locals.inspectorId = sub;
    res.locals.inspectorEmail = email;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
