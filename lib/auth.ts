import { jwtVerify } from 'jose';

export const SESSION_COOKIE = 'fk_session';

export async function readSessionEmail(token: string | undefined): Promise<string | null> {
  if (process.env.NODE_ENV === 'development' && process.env.AUTH_DEV_EMAIL) {
    return process.env.AUTH_DEV_EMAIL;
  }
  const secret = process.env.AUTH_JWT_SECRET;
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: process.env.AUTH_ISSUER,
    });
    return typeof payload.email === 'string' ? payload.email : null;
  } catch {
    return null;
  }
}
