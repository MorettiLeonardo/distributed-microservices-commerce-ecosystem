import type { Request } from 'express';
import { HttpProblem } from './http-problem.js';

const BEARER = /^Bearer (\S+)$/i;
/** Roughly the JWKS fetch timeout: long enough for a transient outage to clear. */
const AUTH_UNAVAILABLE_RETRY_AFTER_SECONDS = 5;

/**
 * Turns an access token into claims. Returns null when the token is malformed, forged or expired;
 * throws when it cannot be checked right now (e.g. the JWKS is unreachable).
 */
export interface TokenVerifier<TClaims> {
  verify(token: string): Promise<TClaims | null>;
}

/**
 * Claims of the request's bearer token. An invalid or missing token is a 401; a verifier that
 * cannot decide is a 503, so clients retry instead of discarding a good token.
 */
export async function authenticate<TClaims>(
  req: Request,
  verifier: TokenVerifier<TClaims>,
): Promise<TClaims> {
  const token = BEARER.exec(req.headers.authorization ?? '')?.[1];
  let claims: TClaims | null = null;
  if (token) {
    try {
      claims = await verifier.verify(token);
    } catch (error) {
      req.log.warn({ err: error }, 'access token verification unavailable');
      throw new HttpProblem(503, 'AUTH_UNAVAILABLE', 'Authentication is temporarily unavailable', {
        'Retry-After': String(AUTH_UNAVAILABLE_RETRY_AFTER_SECONDS),
      });
    }
  }
  if (!claims) {
    throw new HttpProblem(401, 'UNAUTHENTICATED', 'A valid access token is required', {
      'WWW-Authenticate': 'Bearer',
    });
  }
  return claims;
}

/** 403 unless the authenticated caller has one of the roles: known identity, not allowed. */
export function requireRole<TRole extends string>(
  claims: { role: TRole },
  ...allowed: [TRole, ...TRole[]]
): void {
  if (!allowed.includes(claims.role)) {
    throw new HttpProblem(403, 'FORBIDDEN', 'You are not allowed to perform this action');
  }
}
