import { beforeEach, describe, expect, it } from 'vitest';
import { UserNotFoundError } from '../../../../src/application/errors/user-not-found.error.js';
import { GetCurrentUser } from '../../../../src/application/use-cases/get-current-user.use-case.js';
import {
  createTestContext,
  registerUser,
  type TestContext,
} from '../../../support/test-context.js';

describe('GetCurrentUser', () => {
  let ctx: TestContext;
  let getCurrentUser: GetCurrentUser;

  beforeEach(async () => {
    ctx = createTestContext();
    getCurrentUser = new GetCurrentUser(ctx);
    await registerUser(ctx);
  });

  it('returns a plain read model of the user', async () => {
    const [registered] = ctx.eventPublisher.published;

    const user = await getCurrentUser.execute({ userId: registered?.userId ?? '' });

    expect(user).toEqual({
      id: registered?.userId,
      email: 'john@example.com',
      emailVerified: false,
      status: 'pending_verification',
      role: 'customer',
      createdAt: ctx.clock.now(),
    });
  });

  it('fails for an unknown user', async () => {
    await expect(getCurrentUser.execute({ userId: 'ghost' })).rejects.toThrow(UserNotFoundError);
  });
});
