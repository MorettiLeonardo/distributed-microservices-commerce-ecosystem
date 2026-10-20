import { Password } from '../../domain/value-objects/password.value-object.js';
import { InvalidOneTimeTokenError } from '../errors/authentication.error.js';
import type { Clock } from '../ports/clock.port.js';
import type { EventPublisher } from '../ports/event-publisher.port.js';
import type { PasswordHasher } from '../ports/password-hasher.port.js';
import type { SecureTokenGenerator } from '../ports/secure-token-generator.port.js';
import type { UnitOfWork } from '../ports/unit-of-work.port.js';

export type ResetPasswordInput = {
  token: string;
  newPassword: string;
};

export class ResetPassword {
  constructor(
    private readonly deps: {
      unitOfWork: UnitOfWork;
      passwordHasher: PasswordHasher;
      tokenGenerator: SecureTokenGenerator;
      clock: Clock;
      eventPublisher: EventPublisher;
    },
  ) {}

  async execute(input: ResetPasswordInput): Promise<void> {
    const password = Password.create(input.newPassword);
    const tokenHash = this.deps.tokenGenerator.hash(input.token);
    // Hashing is slow: do it before opening the transaction, not while holding it.
    const newHash = await this.deps.passwordHasher.hash(password);
    const now = this.deps.clock.now();

    const events = await this.deps.unitOfWork.run(async ({ users, sessions, oneTimeTokens }) => {
      const token = await oneTimeTokens.findByHash(tokenHash, 'password_reset');
      if (!token) throw new InvalidOneTimeTokenError();

      const user = await users.findById(token.userId);
      if (!user) throw new InvalidOneTimeTokenError();

      token.consume(now);
      user.changePassword(newHash, now);

      // Invariant 7: a password change logs the user out everywhere.
      for (const session of await sessions.findActiveByUserId(user.id)) {
        session.revoke(now);
        await sessions.save(session);
      }

      await oneTimeTokens.save(token);
      await users.save(user);
      return user.pullEvents();
    });

    await this.deps.eventPublisher.publish(events);
  }
}
