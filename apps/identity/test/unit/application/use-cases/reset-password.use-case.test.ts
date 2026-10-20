import { beforeEach, describe, expect, it } from 'vitest';
import {
  InvalidCredentialsError,
  InvalidOneTimeTokenError,
} from '../../../../src/application/errors/authentication.error.js';
import { Login } from '../../../../src/application/use-cases/login.use-case.js';
import { RefreshSession } from '../../../../src/application/use-cases/refresh-session.use-case.js';
import { RequestPasswordReset } from '../../../../src/application/use-cases/request-password-reset.use-case.js';
import { ResetPassword } from '../../../../src/application/use-cases/reset-password.use-case.js';
import { OneTimeTokenAlreadyConsumedError } from '../../../../src/domain/errors/one-time-token.error.js';
import { PasswordTooShortError } from '../../../../src/domain/errors/password.error.js';
import { SessionRevokedError } from '../../../../src/domain/errors/session.error.js';
import {
  createTestContext,
  registerUser,
  type TestContext,
} from '../../../support/test-context.js';

const IP = '203.0.113.7';

describe('ResetPassword', () => {
  let ctx: TestContext;
  let resetPassword: ResetPassword;
  let resetToken: string;

  beforeEach(async () => {
    ctx = createTestContext();
    resetPassword = new ResetPassword(ctx);
    await registerUser(ctx);
    await new RequestPasswordReset(ctx).execute({ email: 'john@example.com' });
    const message = ctx.emailSender.sent.at(-1);
    if (message?.template !== 'password-reset') throw new Error('expected reset email');
    resetToken = message.token;
    ctx.eventPublisher.published.length = 0;
  });

  const loginWith = (password: string) =>
    new Login(ctx).execute({ email: 'john@example.com', password, ip: IP });

  it('replaces the password', async () => {
    await resetPassword.execute({ token: resetToken, newPassword: 'brand new password' });

    await expect(loginWith('brand new password')).resolves.toBeDefined();
    await expect(loginWith('correct horse')).rejects.toThrow(InvalidCredentialsError);
  });

  it('publishes UserPasswordChanged', async () => {
    await resetPassword.execute({ token: resetToken, newPassword: 'brand new password' });

    expect(ctx.eventPublisher.published).toMatchObject([{ type: 'UserPasswordChanged' }]);
  });

  it('logs the user out of every session', async () => {
    const phone = await loginWith('correct horse');
    const laptop = await loginWith('correct horse');

    await resetPassword.execute({ token: resetToken, newPassword: 'brand new password' });

    for (const session of [phone, laptop]) {
      await expect(
        new RefreshSession(ctx).execute({ refreshToken: session.refreshToken }),
      ).rejects.toThrow(SessionRevokedError);
    }
  });

  it('accepts each token only once', async () => {
    await resetPassword.execute({ token: resetToken, newPassword: 'brand new password' });

    await expect(
      resetPassword.execute({ token: resetToken, newPassword: 'another password' }),
    ).rejects.toThrow(OneTimeTokenAlreadyConsumedError);
  });

  it('rejects an unknown token', async () => {
    await expect(
      resetPassword.execute({ token: 'forged', newPassword: 'brand new password' }),
    ).rejects.toThrow(InvalidOneTimeTokenError);
  });

  it('rejects a weak password without consuming the token', async () => {
    await expect(
      resetPassword.execute({ token: resetToken, newPassword: 'short' }),
    ).rejects.toThrow(PasswordTooShortError);

    await expect(
      resetPassword.execute({ token: resetToken, newPassword: 'brand new password' }),
    ).resolves.toBeUndefined();
  });
});
