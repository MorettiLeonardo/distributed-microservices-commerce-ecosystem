import type { UserId } from '../../domain/value-objects/identifiers.js';

export type AccessTokenClaims = {
  userId: UserId;
  email: string;
  emailVerified: boolean;
};

export type IssuedAccessToken = {
  token: string;
  expiresAt: Date;
};

/** Issues signed, short-lived access tokens (ES256 JWT, ADR 0007). */
export interface AccessTokenIssuer {
  issue(claims: AccessTokenClaims): Promise<IssuedAccessToken>;
}
