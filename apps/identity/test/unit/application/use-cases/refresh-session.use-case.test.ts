import { beforeEach, describe, expect, it } from 'vitest';
import { InvalidRefreshTokenError } from '../../../../src/application/errors/authentication.error.js';
import { parseRefreshToken, type TokenPair } from '../../../../src/application/token-pair.js';
import { Login } from '../../../../src/application/use-cases/login.use-case.js';
import { RefreshSession } from '../../../../src/application/use-cases/refresh-session.use-case.js';
import {
  RefreshTokenReuseDetectedError,
  SessionExpiredError,
  SessionRevokedError,
} from '../../../../src/domain/errors/session.error.js';
import {
  createTestContext,
  registerUser,
  SESSION_TTL_MS,
  type TestContext,
} from '../../../support/test-context.js';

describe('RefreshSession', () => {
  let ctx: TestContext;
  let refreshSession: RefreshSession;
  let initial: TokenPair;

  beforeEach(async () => {
    ctx = createTestContext();
    refreshSession = new RefreshSession(ctx);
    await registerUser(ctx);
    initial = await new Login(ctx).execute({
      email: 'john@example.com',
      password: 'correct horse',
      ip: '203.0.113.7',
    });
  });

  it('issues a new token pair for the same session', async () => {
    const next = await refreshSession.execute({ refreshToken: initial.refreshToken });

    expect(next.refreshToken).not.toBe(initial.refreshToken);
    expect(parseRefreshToken(next.refreshToken)?.sessionId).toBe(
      parseRefreshToken(initial.refreshToken)?.sessionId,
    );
    expect(next.refreshTokenExpiresAt).toEqual(initial.refreshTokenExpiresAt);
  });

  it('chains rotations', async () => {
    const second = await refreshSession.execute({ refreshToken: initial.refreshToken });

    await expect(
      refreshSession.execute({ refreshToken: second.refreshToken }),
    ).resolves.toBeDefined();
  });

  describe('when an old refresh token is reused', () => {
    let current: TokenPair;

    beforeEach(async () => {
      current = await refreshSession.execute({ refreshToken: initial.refreshToken });
    });

    it('detects the reuse', async () => {
      await expect(refreshSession.execute({ refreshToken: initial.refreshToken })).rejects.toThrow(
        RefreshTokenReuseDetectedError,
      );
    });

    it('persists the revocation, locking out the current token as well', async () => {
      await refreshSession.execute({ refreshToken: initial.refreshToken }).catch(() => {});

      await expect(refreshSession.execute({ refreshToken: current.refreshToken })).rejects.toThrow(
        SessionRevokedError,
      );
    });
  });

  it('rejects an expired session', async () => {
    ctx.clock.advance(SESSION_TTL_MS);

    await expect(refreshSession.execute({ refreshToken: initial.refreshToken })).rejects.toThrow(
      SessionExpiredError,
    );
  });

  it.each(['', 'no-separator', '.secret', 'session.', 'unknown-session.secret'])(
    'rejects the malformed or unknown token %j',
    async (refreshToken) => {
      await expect(refreshSession.execute({ refreshToken })).rejects.toThrow(
        InvalidRefreshTokenError,
      );
    },
  );
});
