import { describe, expect, it } from 'vitest';
import {
  RefreshTokenReuseDetectedError,
  SessionExpiredError,
  SessionRevokedError,
} from '../../../../src/domain/errors/session.error.js';
import { SessionId, TokenHash, UserId } from '../../../../src/domain/value-objects/identifiers.js';
import { Session } from '../../../../src/domain/entities/session.entity.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const start = new Date('2026-10-19T12:00:00.000Z');
const at = (ms: number) => new Date(start.getTime() + ms);

function startSession(): Session {
  return Session.start({
    id: SessionId('session-1'),
    userId: UserId('user-1'),
    tokenHash: TokenHash('rt-1'),
    now: start,
    ttlMs: 30 * DAY_MS,
  });
}

describe('Session', () => {
  it('expires after its TTL', () => {
    const session = startSession();
    expect(session.expiresAt).toEqual(at(30 * DAY_MS));
    expect(session.isExpired(at(30 * DAY_MS - 1))).toBe(false);
    expect(session.isExpired(at(30 * DAY_MS))).toBe(true);
  });

  describe('rotate', () => {
    it('replaces the current token hash', () => {
      const session = startSession();

      session.rotate({ presentedHash: TokenHash('rt-1'), newHash: TokenHash('rt-2'), now: at(1) });

      expect(session.currentTokenHash).toBe('rt-2');
    });

    it('does not extend the expiry', () => {
      const session = startSession();

      session.rotate({
        presentedHash: TokenHash('rt-1'),
        newHash: TokenHash('rt-2'),
        now: at(DAY_MS),
      });

      expect(session.expiresAt).toEqual(at(30 * DAY_MS));
    });

    it('revokes the whole session when an old token is reused', () => {
      const session = startSession();
      session.rotate({ presentedHash: TokenHash('rt-1'), newHash: TokenHash('rt-2'), now: at(1) });

      expect(() =>
        session.rotate({
          presentedHash: TokenHash('rt-1'),
          newHash: TokenHash('rt-x'),
          now: at(2),
        }),
      ).toThrow(RefreshTokenReuseDetectedError);

      expect(session.revokedAt).toEqual(at(2));
      // The legitimate holder of rt-2 is locked out too: they must log in again.
      expect(() =>
        session.rotate({
          presentedHash: TokenHash('rt-2'),
          newHash: TokenHash('rt-3'),
          now: at(3),
        }),
      ).toThrow(SessionRevokedError);
    });

    it('rejects an expired session', () => {
      const session = startSession();
      expect(() =>
        session.rotate({
          presentedHash: TokenHash('rt-1'),
          newHash: TokenHash('rt-2'),
          now: at(30 * DAY_MS),
        }),
      ).toThrow(SessionExpiredError);
    });
  });

  describe('revoke', () => {
    it('is idempotent and keeps the first revocation time', () => {
      const session = startSession();

      session.revoke(at(1));
      session.revoke(at(2));

      expect(session.revokedAt).toEqual(at(1));
    });
  });
});
