import { describe, expect, it } from 'vitest';
import { CryptoSecureTokenGenerator } from '../../../../../src/adapters/out/security/crypto.secure-token-generator.js';

const generator = new CryptoSecureTokenGenerator();

describe('CryptoSecureTokenGenerator', () => {
  it('generates URL-safe 256-bit tokens', () => {
    const { token } = generator.generate();

    expect(token).toMatch(/^[\w-]{43}$/);
  });

  it('never repeats a token', () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => generator.generate().token));

    expect(tokens.size).toBe(1000);
  });

  it('returns the SHA-256 hash of the token, reproducible from the token alone', () => {
    const { token, hash } = generator.generate();

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(generator.hash(token)).toBe(hash);
  });
});
