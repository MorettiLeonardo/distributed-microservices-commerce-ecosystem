import { beforeEach, describe, expect, it } from 'vitest';
import {
  AccountLockedError,
  InvalidCredentialsError,
  TooManyLoginAttemptsError,
} from '../../../../src/application/errors/authentication.error.js';
import { parseRefreshToken } from '../../../../src/application/token-pair.js';
import { Login } from '../../../../src/application/use-cases/login.use-case.js';
import { VerifyEmail } from '../../../../src/application/use-cases/verify-email.use-case.js';
import { InMemoryLoginAttemptLimiter } from '../../../support/in-memory-login-attempt-limiter.js';
import {
  createTestContext,
  registerUser,
  SESSION_TTL_MS,
  type TestContext,
} from '../../../support/test-context.js';

const IP = '203.0.113.7';
const valid = { email: 'john@example.com', password: 'correct horse', ip: IP };
const wrongPassword = { ...valid, password: 'wrong password' };

describe('Login', () => {
  let ctx: TestContext;
  let login: Login;

  beforeEach(async () => {
    ctx = createTestContext();
    login = new Login(ctx);
    await registerUser(ctx);
    ctx.eventPublisher.published.length = 0;
  });

  it('returns an access token and a refresh token bound to a new session', async () => {
    const tokens = await login.execute(valid);

    expect(tokens.accessToken).toBeTruthy();
    const parsed = parseRefreshToken(tokens.refreshToken);
    const session = parsed && (await ctx.sessions.findById(parsed.sessionId));
    expect(session?.currentTokenHash).toBe(ctx.tokenGenerator.hash(parsed?.secret ?? ''));
    expect(tokens.refreshTokenExpiresAt).toEqual(
      new Date(ctx.clock.now().getTime() + SESSION_TTL_MS),
    );
  });

  it('lets unverified users in, flagging it in the access token', async () => {
    await login.execute(valid);

    expect(ctx.accessTokenIssuer.issued.at(-1)?.emailVerified).toBe(false);
  });

  it('flags verified users in the access token', async () => {
    const token = ctx.emailSender.sent.at(-1);
    if (token?.template !== 'email-verification') throw new Error('expected verification email');
    await new VerifyEmail(ctx).execute({ token: token.token });

    await login.execute(valid);

    expect(ctx.accessTokenIssuer.issued.at(-1)?.emailVerified).toBe(true);
  });

  it('rejects a wrong password and an unknown email with the same error', async () => {
    await expect(login.execute(wrongPassword)).rejects.toThrow(InvalidCredentialsError);
    await expect(login.execute({ ...valid, email: 'ghost@example.com' })).rejects.toThrow(
      InvalidCredentialsError,
    );
  });

  it('treats a malformed email as invalid credentials', async () => {
    await expect(login.execute({ ...valid, email: 'not-an-email' })).rejects.toThrow(
      InvalidCredentialsError,
    );
  });

  const failRepeatedly = async (input: typeof valid, times: number) => {
    for (let i = 0; i < times; i++) {
      await expect(login.execute(input)).rejects.toThrow(InvalidCredentialsError);
    }
  };

  describe('lockout', () => {
    it('locks the account after 5 failures, even for the right password', async () => {
      await failRepeatedly(wrongPassword, InMemoryLoginAttemptLimiter.MAX_FAILURES);

      await expect(login.execute(valid)).rejects.toThrow(AccountLockedError);
    });

    it('publishes UserLockedOut when the lock is triggered', async () => {
      await failRepeatedly(wrongPassword, InMemoryLoginAttemptLimiter.MAX_FAILURES);

      expect(ctx.eventPublisher.published).toMatchObject([{ type: 'UserLockedOut' }]);
    });

    it('locks unknown emails too, without publishing anything', async () => {
      const ghost = { ...valid, email: 'ghost@example.com' };
      await failRepeatedly(ghost, InMemoryLoginAttemptLimiter.MAX_FAILURES);

      await expect(login.execute(ghost)).rejects.toThrow(AccountLockedError);
      expect(ctx.eventPublisher.published).toEqual([]);
    });

    it('lifts the lock once it expires', async () => {
      await failRepeatedly(wrongPassword, InMemoryLoginAttemptLimiter.MAX_FAILURES);
      ctx.clock.advance(InMemoryLoginAttemptLimiter.LOCK_MS);

      await expect(login.execute(valid)).resolves.toBeDefined();
    });

    it('resets the failure count after a successful login', async () => {
      await failRepeatedly(wrongPassword, InMemoryLoginAttemptLimiter.MAX_FAILURES - 1);
      await login.execute(valid);
      await failRepeatedly(wrongPassword, InMemoryLoginAttemptLimiter.MAX_FAILURES - 1);

      await expect(login.execute(valid)).resolves.toBeDefined();
    });
  });

  it('rate limits by IP', async () => {
    for (let i = 0; i < InMemoryLoginAttemptLimiter.MAX_ATTEMPTS_PER_IP; i++) {
      await login.execute(valid);
    }

    await expect(login.execute(valid)).rejects.toThrow(TooManyLoginAttemptsError);
    await expect(login.execute({ ...valid, ip: '198.51.100.1' })).resolves.toBeDefined();
  });
});
