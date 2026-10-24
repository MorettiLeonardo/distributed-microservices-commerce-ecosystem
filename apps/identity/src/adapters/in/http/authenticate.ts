import type { Request } from 'express';
import type { AccessTokenClaims } from '../../../application/ports/access-token-issuer.port.js';
import type { AccessTokenVerifier } from '../../../application/ports/access-token-verifier.port.js';
import { HttpProblem } from './problem-details.js';

const BEARER = /^Bearer (\S+)$/i;

/** Claims of the request's bearer token; throws a 401 problem when missing or invalid. */
export async function authenticate(
  req: Request,
  verifier: AccessTokenVerifier,
): Promise<AccessTokenClaims> {
  const token = BEARER.exec(req.headers.authorization ?? '')?.[1];
  const claims = token ? await verifier.verify(token) : null;
  if (!claims) {
    throw new HttpProblem(401, 'UNAUTHENTICATED', 'A valid access token is required', {
      'WWW-Authenticate': 'Bearer',
    });
  }
  return claims;
}
