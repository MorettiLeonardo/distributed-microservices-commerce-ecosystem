import type { TokenHash } from '../../domain/value-objects/identifiers.js';

export type GeneratedToken = {
  /** Sent to the user; never stored. */
  token: string;
  /** Stored instead of the token. */
  hash: TokenHash;
};

/** Cryptographically secure random secrets for refresh and one-time tokens. */
export interface SecureTokenGenerator {
  generate(): GeneratedToken;
  hash(token: string): TokenHash;
}
