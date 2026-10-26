import { beforeEach, describe, expect, it } from 'vitest';
import { UserNotFoundError } from '../../../../src/application/errors/user-not-found.error.js';
import { PromoteUserToAdmin } from '../../../../src/application/use-cases/promote-user-to-admin.use-case.js';
import { VerifyEmail } from '../../../../src/application/use-cases/verify-email.use-case.js';
import { EmailNotVerifiedError } from '../../../../src/domain/errors/user.error.js';
import { Email } from '../../../../src/domain/value-objects/email.value-object.js';
import {
  createTestContext,
  registerUser,
  type TestContext,
} from '../../../support/test-context.js';

const EMAIL = 'john@example.com';

describe('PromoteUserToAdmin', () => {
  let ctx: TestContext;
  let promote: PromoteUserToAdmin;
  let verificationToken: string;

  beforeEach(async () => {
    ctx = createTestContext();
    promote = new PromoteUserToAdmin(ctx);
    verificationToken = await registerUser(ctx);
  });

  const verifyEmail = () => new VerifyEmail(ctx).execute({ token: verificationToken });

  it('promotes a verified user and persists the new role', async () => {
    await verifyEmail();

    const result = await promote.execute({ email: ' John@Example.com ' });

    const stored = await ctx.users.findByEmail(Email.create(EMAIL));
    expect(stored?.role).toBe('admin');
    expect(result).toEqual({ userId: stored?.id, email: EMAIL, alreadyAdmin: false });
  });

  it('reports an existing admin without failing', async () => {
    await verifyEmail();
    await promote.execute({ email: EMAIL });

    expect((await promote.execute({ email: EMAIL })).alreadyAdmin).toBe(true);
  });

  it('rejects a user whose email is not verified, leaving the role unchanged', async () => {
    await expect(promote.execute({ email: EMAIL })).rejects.toThrow(EmailNotVerifiedError);

    expect((await ctx.users.findByEmail(Email.create(EMAIL)))?.role).toBe('customer');
  });

  it('fails for an unknown email', async () => {
    await expect(promote.execute({ email: 'nobody@example.com' })).rejects.toThrow(
      UserNotFoundError,
    );
  });
});
