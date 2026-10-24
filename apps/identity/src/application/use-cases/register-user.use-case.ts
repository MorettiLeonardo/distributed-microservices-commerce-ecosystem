import { OneTimeToken } from '../../domain/entities/one-time-token.entity.js';
import { User } from '../../domain/entities/user.entity.js';
import { Email } from '../../domain/value-objects/email.value-object.js';
import { OneTimeTokenId, UserId } from '../../domain/value-objects/identifiers.js';
import { Password } from '../../domain/value-objects/password.value-object.js';
import { EmailAlreadyRegisteredError } from '../errors/email-already-registered.error.js';
import type { Clock } from '../ports/clock.port.js';
import type { EmailSender } from '../ports/email-sender.port.js';
import type { EventPublisher } from '../ports/event-publisher.port.js';
import type { IdGenerator } from '../ports/id-generator.port.js';
import type { PasswordHasher } from '../ports/password-hasher.port.js';
import type { SecureTokenGenerator } from '../ports/secure-token-generator.port.js';
import type { UnitOfWork } from '../ports/unit-of-work.port.js';
import type { UserRepository } from '../ports/user.repository.port.js';

export type RegisterUserInput = {
  email: string;
  password: string;
};

export class RegisterUser {
  constructor(
    private readonly deps: {
      users: UserRepository;
      unitOfWork: UnitOfWork;
      passwordHasher: PasswordHasher;
      tokenGenerator: SecureTokenGenerator;
      idGenerator: IdGenerator;
      clock: Clock;
      eventPublisher: EventPublisher;
      emailSender: EmailSender;
    },
  ) {}

  /**
   * Resolves the same way whether or not the email is already taken (anti-enumeration, ADR 0007):
   * the owner of an existing account receives a notice email instead.
   */
  async execute(input: RegisterUserInput): Promise<void> {
    const email = Email.create(input.email);
    const password = Password.create(input.password);

    // Hash BEFORE checking for an existing account: skipping bcrypt on that path would make it
    // measurably faster and leak which emails are registered.
    const passwordHash = await this.deps.passwordHasher.hash(password);

    if (await this.deps.users.findByEmail(email)) {
      await this.deps.emailSender.send({ template: 'account-already-exists', to: email.value });
      return;
    }

    const now = this.deps.clock.now();
    const user = User.register({
      id: UserId(this.deps.idGenerator.generate()),
      email,
      passwordHash,
      now,
    });
    const verification = this.deps.tokenGenerator.generate();
    const verificationToken = OneTimeToken.issue({
      id: OneTimeTokenId(this.deps.idGenerator.generate()),
      userId: user.id,
      purpose: 'email_verification',
      tokenHash: verification.hash,
      now,
    });

    try {
      await this.deps.unitOfWork.run(async ({ users, oneTimeTokens }) => {
        await users.save(user);
        await oneTimeTokens.save(verificationToken);
      });
    } catch (error) {
      // A concurrent registration of the same email won the race between our findByEmail and
      // save: answer exactly as if the email had already been taken.
      if (error instanceof EmailAlreadyRegisteredError) {
        await this.deps.emailSender.send({ template: 'account-already-exists', to: email.value });
        return;
      }
      throw error;
    }

    // Naive dual write: if the process dies right here, the user is saved but neither the event
    // nor the email ever goes out. To be fixed with the Transactional Outbox.
    await this.deps.eventPublisher.publish(user.pullEvents());
    await this.deps.emailSender.send({
      template: 'email-verification',
      to: email.value,
      token: verification.token,
    });
  }
}
