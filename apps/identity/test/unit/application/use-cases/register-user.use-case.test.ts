import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegisterUser } from '../../../../src/application/use-cases/register-user.use-case.js';
import { InvalidEmailError } from '../../../../src/domain/errors/email.error.js';
import { PasswordTooShortError } from '../../../../src/domain/errors/password.error.js';
import { Email } from '../../../../src/domain/value-objects/email.value-object.js';
import { createTestContext, type TestContext } from '../../../support/test-context.js';

describe('RegisterUser', () => {
  let ctx: TestContext;
  let registerUser: RegisterUser;

  beforeEach(() => {
    ctx = createTestContext();
    registerUser = new RegisterUser(ctx);
  });

  it('saves a pending user with a hashed password', async () => {
    await registerUser.execute({ email: 'John@Example.com', password: 'correct horse' });

    const user = await ctx.users.findByEmail(Email.create('john@example.com'));
    expect(user?.status).toBe('pending_verification');
    expect(user?.passwordHash).toBe('hashed:correct horse');
  });

  it('publishes UserRegistered', async () => {
    await registerUser.execute({ email: 'john@example.com', password: 'correct horse' });

    expect(ctx.eventPublisher.published).toMatchObject([
      { type: 'UserRegistered', email: 'john@example.com' },
    ]);
  });

  it('emails a verification token and stores only its hash', async () => {
    await registerUser.execute({ email: 'john@example.com', password: 'correct horse' });

    expect(ctx.emailSender.sent).toEqual([
      { template: 'email-verification', to: 'john@example.com', token: 'secret-1' },
    ]);
    const stored = await ctx.oneTimeTokens.findByHash(
      ctx.tokenGenerator.hash('secret-1'),
      'email_verification',
    );
    expect(stored).not.toBeNull();
    expect(JSON.stringify([...ctx.db.tables.oneTimeTokens.values()])).not.toContain('"secret-1"');
  });

  describe('when the email is already registered', () => {
    beforeEach(async () => {
      await registerUser.execute({ email: 'john@example.com', password: 'correct horse' });
      ctx.eventPublisher.published.length = 0;
      ctx.emailSender.sent.length = 0;
    });

    it('resolves exactly like a successful registration', async () => {
      await expect(
        registerUser.execute({ email: 'JOHN@example.com', password: 'another password' }),
      ).resolves.toBeUndefined();
    });

    it('notifies the account owner instead of creating a user', async () => {
      await registerUser.execute({ email: 'john@example.com', password: 'another password' });

      expect(ctx.db.tables.users.size).toBe(1);
      expect(ctx.eventPublisher.published).toEqual([]);
      expect(ctx.emailSender.sent).toEqual([
        { template: 'account-already-exists', to: 'john@example.com' },
      ]);
    });

    it('still hashes the password so both paths take the same time', async () => {
      const hash = vi.spyOn(ctx.passwordHasher, 'hash');

      await registerUser.execute({ email: 'john@example.com', password: 'another password' });

      expect(hash).toHaveBeenCalledOnce();
    });
  });

  it('creates a single user when two registrations of the same email race', async () => {
    const credentials = { email: 'john@example.com', password: 'correct horse' };

    // Both pass findByEmail before either saves; the UNIQUE index stops the second one.
    await Promise.all([registerUser.execute(credentials), registerUser.execute(credentials)]);

    expect(ctx.db.tables.users.size).toBe(1);
    expect(ctx.emailSender.sent.map((message) => message.template).toSorted()).toEqual([
      'account-already-exists',
      'email-verification',
    ]);
  });

  it('rejects an invalid email', async () => {
    await expect(
      registerUser.execute({ email: 'nope', password: 'correct horse' }),
    ).rejects.toThrow(InvalidEmailError);
  });

  it('rejects a password that violates the policy', async () => {
    await expect(
      registerUser.execute({ email: 'john@example.com', password: 'short' }),
    ).rejects.toThrow(PasswordTooShortError);
  });

  it('saves nothing and sends nothing when persisting the token fails', async () => {
    vi.spyOn(ctx.oneTimeTokens, 'save').mockRejectedValueOnce(new Error('database down'));

    await expect(
      registerUser.execute({ email: 'john@example.com', password: 'correct horse' }),
    ).rejects.toThrow('database down');

    expect(ctx.db.tables.users.size).toBe(0);
    expect(ctx.eventPublisher.published).toEqual([]);
    expect(ctx.emailSender.sent).toEqual([]);
  });
});
