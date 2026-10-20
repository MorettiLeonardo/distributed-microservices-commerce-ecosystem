import { beforeEach, describe, expect, it } from 'vitest';
import type { TokenPair } from '../../../../src/application/token-pair.js';
import { Login } from '../../../../src/application/use-cases/login.use-case.js';
import { Logout } from '../../../../src/application/use-cases/logout.use-case.js';
import { RefreshSession } from '../../../../src/application/use-cases/refresh-session.use-case.js';
import { SessionRevokedError } from '../../../../src/domain/errors/session.error.js';
import {
  createTestContext,
  registerUser,
  type TestContext,
} from '../../../support/test-context.js';

describe('Logout', () => {
  let ctx: TestContext;
  let logout: Logout;
  let tokens: TokenPair;

  beforeEach(async () => {
    ctx = createTestContext();
    logout = new Logout(ctx);
    await registerUser(ctx);
    tokens = await new Login(ctx).execute({
      email: 'john@example.com',
      password: 'correct horse',
      ip: '203.0.113.7',
    });
  });

  it('revokes the session', async () => {
    await logout.execute({ refreshToken: tokens.refreshToken });

    await expect(
      new RefreshSession(ctx).execute({ refreshToken: tokens.refreshToken }),
    ).rejects.toThrow(SessionRevokedError);
  });

  it('is idempotent', async () => {
    await logout.execute({ refreshToken: tokens.refreshToken });

    await expect(logout.execute({ refreshToken: tokens.refreshToken })).resolves.toBeUndefined();
  });

  it.each(['', 'garbage', 'unknown-session.secret'])(
    'ignores the token %j',
    async (refreshToken) => {
      await expect(logout.execute({ refreshToken })).resolves.toBeUndefined();
    },
  );

  it('ignores a stale token so it cannot log the real user out', async () => {
    const current = await new RefreshSession(ctx).execute({ refreshToken: tokens.refreshToken });

    await logout.execute({ refreshToken: tokens.refreshToken });

    await expect(
      new RefreshSession(ctx).execute({ refreshToken: current.refreshToken }),
    ).resolves.toBeDefined();
  });
});
