import type {
  AccessTokenClaims,
  AccessTokenIssuer,
  IssuedAccessToken,
} from '../../src/application/ports/access-token-issuer.port.js';
import type { Clock } from '../../src/application/ports/clock.port.js';
import type { EmailMessage, EmailSender } from '../../src/application/ports/email-sender.port.js';
import type { EventPublisher } from '../../src/application/ports/event-publisher.port.js';
import type { IdGenerator } from '../../src/application/ports/id-generator.port.js';
import type { LoginAttemptLimiter } from '../../src/application/ports/login-attempt-limiter.port.js';
import type { PasswordHasher } from '../../src/application/ports/password-hasher.port.js';
import type {
  GeneratedToken,
  SecureTokenGenerator,
} from '../../src/application/ports/secure-token-generator.port.js';
import type { IdentityEvent } from '../../src/domain/events/user.events.js';
import type { Email } from '../../src/domain/value-objects/email.value-object.js';
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

/** Same thresholds as production (ADR 0007), without time windows. */
export class InMemoryLoginAttemptLimiter implements LoginAttemptLimiter {
  static readonly MAX_ATTEMPTS_PER_IP = 20;
  static readonly MAX_FAILURES = 5;
  static readonly LOCK_MS = 15 * 60_000;

  readonly #attemptsByIp = new Map<string, number>();
  readonly #failures = new Map<string, number>();
  readonly #locks = new Map<string, Date>();

  constructor(private readonly clock: Clock) {}

  async registerAttempt(ip: string): Promise<boolean> {
    const attempts = (this.#attemptsByIp.get(ip) ?? 0) + 1;
    this.#attemptsByIp.set(ip, attempts);
    return attempts <= InMemoryLoginAttemptLimiter.MAX_ATTEMPTS_PER_IP;
  }

  async lockedUntil(email: Email): Promise<Date | null> {
    const until = this.#locks.get(email.value);
    return until && until > this.clock.now() ? until : null;
  }

  async registerFailure(email: Email): Promise<Date | null> {
    const failures = (this.#failures.get(email.value) ?? 0) + 1;
    if (failures < InMemoryLoginAttemptLimiter.MAX_FAILURES) {
      this.#failures.set(email.value, failures);
      return null;
    }
    this.#failures.delete(email.value);
    const until = new Date(this.clock.now().getTime() + InMemoryLoginAttemptLimiter.LOCK_MS);
    this.#locks.set(email.value, until);
    return until;
  }

  async clearFailures(email: Email): Promise<void> {
    this.#failures.delete(email.value);
  }
}
