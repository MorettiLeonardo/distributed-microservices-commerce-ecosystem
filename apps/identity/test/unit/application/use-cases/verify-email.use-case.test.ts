import { beforeEach, describe, expect, it } from 'vitest';
import { InvalidOneTimeTokenError } from '../../../../src/application/errors/authentication.error.js';
import { VerifyEmail } from '../../../../src/application/use-cases/verify-email.use-case.js';
import {
  OneTimeTokenAlreadyConsumedError,
  OneTimeTokenExpiredError,
} from '../../../../src/domain/errors/one-time-token.error.js';
import { Email } from '../../../../src/domain/value-objects/email.value-object.js';
import {
  createTestContext,
  DAY_MS,
  registerUser,
  type TestContext,
} from '../../../support/test-context.js';

describe('VerifyEmail', () => {
  let ctx: TestContext;
  let verifyEmail: VerifyEmail;
  let token: string;

  const findUser = () => ctx.users.findByEmail(Email.create('john@example.com'));

  beforeEach(async () => {
    ctx = createTestContext();
    verifyEmail = new VerifyEmail(ctx);
    token = await registerUser(ctx);
    ctx.eventPublisher.published.length = 0;
  });

  it('activates the user and publishes UserEmailVerified', async () => {
    await verifyEmail.execute({ token });

    const user = await findUser();
    expect(user?.status).toBe('active');
    expect(user?.isEmailVerified).toBe(true);
    expect(ctx.eventPublisher.published).toMatchObject([{ type: 'UserEmailVerified' }]);
  });

  it('rejects a token that was already used', async () => {
    await verifyEmail.execute({ token });

    await expect(verifyEmail.execute({ token })).rejects.toThrow(OneTimeTokenAlreadyConsumedError);
  });

  it('rejects an unknown token', async () => {
    await expect(verifyEmail.execute({ token: 'forged' })).rejects.toThrow(
      InvalidOneTimeTokenError,
    );
  });

  it('rejects an expired token and leaves the user unverified', async () => {
    ctx.clock.advance(DAY_MS);

    await expect(verifyEmail.execute({ token })).rejects.toThrow(OneTimeTokenExpiredError);
    expect((await findUser())?.isEmailVerified).toBe(false);
  });
});
