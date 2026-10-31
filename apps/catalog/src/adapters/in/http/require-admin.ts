import type { AccessTokenClaims } from '@ecommerce/auth';
import { authenticate, requireRole, type TokenVerifier } from '@ecommerce/http';
import type { RequestHandler } from 'express';

/**
 * Gate in front of every admin route: 401 without a valid token, 403 for non-admins, 503 when
 * tokens cannot be verified. Mounted once on the `/v1/admin` prefix, so a new admin route is
 * protected without having to remember it. Express 5 forwards the rejection to the error handler.
 */
export function requireAdmin(verifier: TokenVerifier<AccessTokenClaims>): RequestHandler {
  return async (req, _res, next) => {
    requireRole(await authenticate(req, verifier), 'admin');
    next();
  };
}
