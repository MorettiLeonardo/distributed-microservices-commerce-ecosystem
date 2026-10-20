import { SessionId } from '../domain/value-objects/identifiers.js';

export type TokenPair = {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
};

const SEPARATOR = '.';

/**
 * Refresh tokens are `<sessionId>.<secret>`. Carrying the session id lets us find the session
 * even when an OLD secret is presented — exactly what reuse detection needs.
 * Only the secret's hash is stored.
 */
export function formatRefreshToken(sessionId: SessionId, secret: string): string {
  return `${sessionId}${SEPARATOR}${secret}`;
}

export function parseRefreshToken(raw: string): { sessionId: SessionId; secret: string } | null {
  const index = raw.indexOf(SEPARATOR);
  if (index <= 0 || index === raw.length - 1) return null;
  return { sessionId: SessionId(raw.slice(0, index)), secret: raw.slice(index + 1) };
}
