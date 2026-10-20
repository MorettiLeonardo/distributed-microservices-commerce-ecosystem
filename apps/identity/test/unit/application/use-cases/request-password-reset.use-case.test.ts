import { beforeEach, describe, expect, it } from 'vitest';
import { RequestPasswordReset } from '../../../../src/application/use-cases/request-password-reset.use-case.js';
import {
  createTestContext,
  registerUser,
  type TestContext,
} from '../../../support/test-context.js';

describe('RequestPasswordReset', () => {
  let ctx: TestContext;
  let requestPasswordReset: RequestPasswordReset;

  beforeEach(async () => {
    ctx = createTestContext();
    requestPasswordReset = new RequestPasswordReset(ctx);
    await registerUser(ctx);
    ctx.eventPublisher.published.length = 0;
    ctx.emailSender.sent.length = 0;
  });

  it('emails a reset token and stores only its hash', async () => {
    await requestPasswordReset.execute({ email: 'John@Example.com' });

    const [message] = ctx.emailSender.sent;
    expect(message).toMatchObject({ template: 'password-reset', to: 'john@example.com' });
    if (message?.template !== 'password-reset') throw new Error('expected reset email');
    const stored = await ctx.oneTimeTokens.findByHash(
      ctx.tokenGenerator.hash(message.token),
      'password_reset',
    );
    expect(stored).not.toBeNull();
  });

  it('publishes UserPasswordResetRequested', async () => {
    await requestPasswordReset.execute({ email: 'john@example.com' });

    expect(ctx.eventPublisher.published).toMatchObject([{ type: 'UserPasswordResetRequested' }]);
  });

  it('silently does nothing for an unknown email', async () => {
    await expect(
      requestPasswordReset.execute({ email: 'ghost@example.com' }),
    ).resolves.toBeUndefined();

    expect(ctx.emailSender.sent).toEqual([]);
    expect(ctx.eventPublisher.published).toEqual([]);
  });
});
