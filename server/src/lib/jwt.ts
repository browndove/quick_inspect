import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';

export type AccessPayload = {
  sub: string;
  email: string;
};

export function signAccessToken(payload: AccessPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  const expiresIn = (process.env.JWT_EXPIRES_IN ?? '7d') as NonNullable<SignOptions['expiresIn']>;
  const options: SignOptions = {
    expiresIn,
    subject: payload.sub,
  };
  return jwt.sign({ email: payload.email }, secret, options);
}

export function verifyAccessToken(token: string): AccessPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  const decoded = jwt.verify(token, secret) as JwtPayload;
  if (!decoded.sub || typeof decoded.email !== 'string') {
    throw new Error('Invalid token payload');
  }
  return { sub: decoded.sub, email: decoded.email };
}
