import { createRemoteJWKSet, errors, jwtVerify } from 'jose';
import { type AccessTokenClaims, toClaims } from './access-token-claims.js';

/** The token could not be checked right now (JWKS unreachable, slow or broken): retry later. */
export class AuthUnavailableError extends Error {
  constructor(options: { cause: unknown }) {
    super('Access tokens cannot be verified right now', options);
    this.name = 'AuthUnavailableError';
  }
}

/**
 * Failures caused by the token itself. Anything else (timeouts, network, a broken JWKS) is our
 * problem: allow-listing token errors makes an unforeseen failure a retryable 503, never a 401
 * that would make clients throw away a perfectly good token.
 */
const TOKEN_ERRORS = [
  errors.JWTExpired,
  errors.JWTInvalid,
  errors.JWTClaimValidationFailed,
  errors.JWSInvalid,
  errors.JWSSignatureVerificationFailed,
  errors.JOSEAlgNotAllowed,
  errors.JOSENotSupported,
  errors.JWKSNoMatchingKey,
  errors.JWKSMultipleMatchingKeys,
];

export type JwksAccessTokenVerifierOptions = {
  /** Identity's `/.well-known/jwks.json`. */
  jwksUrl: string;
  issuer: string;
  audience: string;
  /** Minimum time between JWKS refetches, also on unknown `kid`s. jose default: 30 s. */
  cooldownMs?: number;
  /** jose default: 5 s. */
  timeoutMs?: number;
};

/**
 * Verifies identity's ES256 access tokens locally with keys fetched from its JWKS (ADR 0013).
 * Keys are fetched lazily, cached, and refetched when a token names an unknown `kid` (rotation).
 */
export class JwksAccessTokenVerifier {
  private readonly keys: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly options: JwksAccessTokenVerifierOptions) {
    this.keys = createRemoteJWKSet(new URL(options.jwksUrl), {
      ...(options.cooldownMs !== undefined && { cooldownDuration: options.cooldownMs }),
      ...(options.timeoutMs !== undefined && { timeoutDuration: options.timeoutMs }),
    });
  }

  /** The claims, or null when the token is invalid. Throws `AuthUnavailableError` when unsure. */
  async verify(token: string): Promise<AccessTokenClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.keys, {
        algorithms: ['ES256'],
        issuer: this.options.issuer,
        audience: this.options.audience,
      });
      return toClaims(payload);
    } catch (error) {
      if (TOKEN_ERRORS.some((tokenError) => error instanceof tokenError)) return null;
      throw new AuthUnavailableError({ cause: error });
    }
  }
}
