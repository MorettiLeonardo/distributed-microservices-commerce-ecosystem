import { describe, expect, it } from 'vitest';
import {
  OneTimeTokenAlreadyConsumedError,
  OneTimeTokenExpiredError,
} from '../../../../src/domain/errors/one-time-token.error.js';
import {
  OneTimeTokenId,
  TokenHash,
  UserId,
} from '../../../../src/domain/value-objects/identifiers.js';
import {
  OneTimeToken,
  type OneTimeTokenPurpose,
} from '../../../../src/domain/entities/one-time-token.entity.js';

const MINUTE_MS = 60 * 1000;
const issuedAt = new Date('2026-10-19T12:00:00.000Z');
const at = (ms: number) => new Date(issuedAt.getTime() + ms);

function issue(purpose: OneTimeTokenPurpose): OneTimeToken {
  return OneTimeToken.issue({
    id: OneTimeTokenId('ott-1'),
    userId: UserId('user-1'),
    purpose,
    tokenHash: TokenHash('hash'),
    now: issuedAt,
  });
}

describe('OneTimeToken', () => {
  it.each([
    ['email_verification', 24 * 60 * MINUTE_MS],
    ['password_reset', 30 * MINUTE_MS],
  ] as const)('a %s token expires after %i ms', (purpose, ttlMs) => {
    expect(issue(purpose).expiresAt).toEqual(at(ttlMs));
  });

  it('can be consumed before it expires', () => {
    const token = issue('password_reset');

    token.consume(at(29 * MINUTE_MS));

    expect(token.consumedAt).toEqual(at(29 * MINUTE_MS));
  });

  it('cannot be consumed twice', () => {
    const token = issue('password_reset');
    token.consume(at(1));

    expect(() => token.consume(at(2))).toThrow(OneTimeTokenAlreadyConsumedError);
  });

  it('cannot be consumed once expired', () => {
    const token = issue('password_reset');

    expect(() => token.consume(at(30 * MINUTE_MS))).toThrow(OneTimeTokenExpiredError);
    expect(token.consumedAt).toBeNull();
  });
});
