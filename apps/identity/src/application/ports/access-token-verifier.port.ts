import type { AccessTokenClaims } from './access-token-issuer.port.js';

/** Validates access tokens issued by `AccessTokenIssuer` (signature, issuer, audience, expiry). */
export interface AccessTokenVerifier {
  /** The token's claims, or null when it is malformed, forged or expired. */
  verify(token: string): Promise<AccessTokenClaims | null>;
}
