import { createHash, randomBytes } from 'node:crypto';
import type {
  GeneratedToken,
  SecureTokenGenerator,
} from '../../../application/ports/secure-token-generator.port.js';
import { TokenHash } from '../../../domain/value-objects/identifiers.js';

/** 256 bits of entropy: far beyond brute force, so a fast hash is enough (unlike passwords). */
const TOKEN_BYTES = 32;

export class CryptoSecureTokenGenerator implements SecureTokenGenerator {
  generate(): GeneratedToken {
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    return { token, hash: this.hash(token) };
  }

  hash(token: string): TokenHash {
    return TokenHash(createHash('sha256').update(token).digest('hex'));
  }
}
