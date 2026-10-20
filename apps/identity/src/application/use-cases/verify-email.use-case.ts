import { InvalidOneTimeTokenError } from '../errors/authentication.error.js';
import type { Clock } from '../ports/clock.port.js';
import type { EventPublisher } from '../ports/event-publisher.port.js';
import type { SecureTokenGenerator } from '../ports/secure-token-generator.port.js';
import type { UnitOfWork } from '../ports/unit-of-work.port.js';

export type VerifyEmailInput = {
  token: string;
};

export class VerifyEmail {
  constructor(
    private readonly deps: {
      unitOfWork: UnitOfWork;
      tokenGenerator: SecureTokenGenerator;
      clock: Clock;
      eventPublisher: EventPublisher;
    },
  ) {}

  async execute(input: VerifyEmailInput): Promise<void> {
    const tokenHash = this.deps.tokenGenerator.hash(input.token);
    const now = this.deps.clock.now();

    const events = await this.deps.unitOfWork.run(async ({ users, oneTimeTokens }) => {
      const token = await oneTimeTokens.findByHash(tokenHash, 'email_verification');
      if (!token) throw new InvalidOneTimeTokenError();

      const user = await users.findById(token.userId);
      if (!user) throw new InvalidOneTimeTokenError();

      token.consume(now);
      user.verifyEmail(now);

      await oneTimeTokens.save(token);
      await users.save(user);
      return user.pullEvents();
    });

    await this.deps.eventPublisher.publish(events);
  }
}
