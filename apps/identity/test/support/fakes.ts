import type {
  AccessTokenClaims,
  AccessTokenIssuer,
  IssuedAccessToken,
} from '../../src/application/ports/access-token-issuer.port.js';
import type { Clock } from '../../src/application/ports/clock.port.js';
import type { EmailMessage, EmailSender } from '../../src/application/ports/email-sender.port.js';
import type { EventPublisher } from '../../src/application/ports/event-publisher.port.js';
import type { IdGenerator } from '../../src/application/ports/id-generator.port.js';
import type { PasswordHasher } from '../../src/application/ports/password-hasher.port.js';
import type {
  GeneratedToken,
  SecureTokenGenerator,
} from '../../src/application/ports/secure-token-generator.port.js';
import type { IdentityEvent } from '../../src/domain/events/user.events.js';
import { PasswordHash, TokenHash } from '../../src/domain/value-objects/identifiers.js';
import type { Password } from '../../src/domain/value-objects/password.value-object.js';

export class FakeClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export class SequentialIdGenerator implements IdGenerator {
  #next = 0;

  generate(): string {
    this.#next += 1;
    return `id-${this.#next}`;
  }
}

/** Reversible on purpose so tests can read it; the real adapter uses bcrypt. */
export class FakePasswordHasher implements PasswordHasher {
  async hash(password: Password): Promise<PasswordHash> {
    return PasswordHash(`hashed:${password.value}`);
  }

  async verify(plain: string, hash: PasswordHash | null): Promise<boolean> {
    return hash !== null && hash === `hashed:${plain}`;
  }
}

export class FakeSecureTokenGenerator implements SecureTokenGenerator {
  #next = 0;

  generate(): GeneratedToken {
    this.#next += 1;
    const token = `secret-${this.#next}`;
    return { token, hash: this.hash(token) };
  }

  hash(token: string): TokenHash {
    return TokenHash(`sha256:${token}`);
  }
}

export class FakeAccessTokenIssuer implements AccessTokenIssuer {
  readonly issued: AccessTokenClaims[] = [];

  constructor(private readonly clock: Clock) {}

  async issue(claims: AccessTokenClaims): Promise<IssuedAccessToken> {
    this.issued.push(claims);
    return {
      token: `access-token:${claims.userId}`,
      expiresAt: new Date(this.clock.now().getTime() + 15 * 60_000),
    };
  }
}

export class RecordingEventPublisher implements EventPublisher {
  readonly published: IdentityEvent[] = [];

  async publish(events: readonly IdentityEvent[]): Promise<void> {
    this.published.push(...events);
  }
}

export class RecordingEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}
