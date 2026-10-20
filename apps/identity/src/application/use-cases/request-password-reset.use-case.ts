import { OneTimeToken } from '../../domain/entities/one-time-token.entity.js';
import { Email } from '../../domain/value-objects/email.value-object.js';
import { OneTimeTokenId } from '../../domain/value-objects/identifiers.js';
import type { Clock } from '../ports/clock.port.js';
import type { EmailSender } from '../ports/email-sender.port.js';
import type { EventPublisher } from '../ports/event-publisher.port.js';
import type { IdGenerator } from '../ports/id-generator.port.js';
import type { OneTimeTokenRepository } from '../ports/one-time-token.repository.port.js';
import type { SecureTokenGenerator } from '../ports/secure-token-generator.port.js';
import type { UserRepository } from '../ports/user.repository.port.js';

export type RequestPasswordResetInput = {
  email: string;
};

export class RequestPasswordReset {
  constructor(
    private readonly deps: {
      users: UserRepository;
      oneTimeTokens: OneTimeTokenRepository;
      tokenGenerator: SecureTokenGenerator;
      idGenerator: IdGenerator;
      clock: Clock;
      eventPublisher: EventPublisher;
      emailSender: EmailSender;
    },
  ) {}

  /** Resolves the same way for unknown emails (anti-enumeration, ADR 0007). */
  async execute(input: RequestPasswordResetInput): Promise<void> {
    const email = Email.create(input.email);
    const user = await this.deps.users.findByEmail(email);
    if (!user || user.status === 'disabled') return;

    const now = this.deps.clock.now();
    user.requestPasswordReset(now);

    const reset = this.deps.tokenGenerator.generate();
    await this.deps.oneTimeTokens.save(
      OneTimeToken.issue({
        id: OneTimeTokenId(this.deps.idGenerator.generate()),
        userId: user.id,
        purpose: 'password_reset',
        tokenHash: reset.hash,
        now,
      }),
    );

    await this.deps.eventPublisher.publish(user.pullEvents());
    await this.deps.emailSender.send({
      template: 'password-reset',
      to: email.value,
      token: reset.token,
    });
  }
}
