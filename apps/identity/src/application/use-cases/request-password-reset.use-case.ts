import { OneTimeToken, OneTimeTokenPurpose } from '#src/domain/entities/one-time-token.entity.js';
import { UserStatus } from '#src/domain/entities/user.entity.js';
import { Email } from '#src/domain/value-objects/email.value-object.js';
import { OneTimeTokenId } from '#src/domain/value-objects/identifiers.js';
import type { Clock } from '#src/application/ports/clock.port.js';
import type { EmailSender } from '#src/application/ports/email-sender.port.js';
import type { EventPublisher } from '#src/application/ports/event-publisher.port.js';
import type { IdGenerator } from '#src/application/ports/id-generator.port.js';
import type { OneTimeTokenRepository } from '#src/application/ports/one-time-token.repository.port.js';
import type { SecureTokenGenerator } from '#src/application/ports/secure-token-generator.port.js';
import type { UserRepository } from '#src/application/ports/user.repository.port.js';

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
    if (!user || user.status === UserStatus.Disabled) return;

    const now = this.deps.clock.now();
    user.requestPasswordReset(now);

    const reset = this.deps.tokenGenerator.generate();
    await this.deps.oneTimeTokens.save(
      OneTimeToken.issue({
        id: OneTimeTokenId(this.deps.idGenerator.generate()),
        userId: user.id,
        purpose: OneTimeTokenPurpose.PasswordReset,
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
