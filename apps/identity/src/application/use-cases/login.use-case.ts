import { Session } from '../../domain/entities/session.entity.js';
import type { User } from '../../domain/entities/user.entity.js';
import { UserDisabledError } from '../../domain/errors/user.error.js';
import { Email } from '../../domain/value-objects/email.value-object.js';
import { SessionId } from '../../domain/value-objects/identifiers.js';
import {
  AccountLockedError,
  InvalidCredentialsError,
  TooManyLoginAttemptsError,
} from '../errors/authentication.error.js';
import type { AccessTokenIssuer } from '../ports/access-token-issuer.port.js';
import type { Clock } from '../ports/clock.port.js';
import type { EventPublisher } from '../ports/event-publisher.port.js';
import type { IdGenerator } from '../ports/id-generator.port.js';
import type { LoginAttemptLimiter } from '../ports/login-attempt-limiter.port.js';
import type { PasswordHasher } from '../ports/password-hasher.port.js';
import type { SecureTokenGenerator } from '../ports/secure-token-generator.port.js';
import type { SessionRepository } from '../ports/session.repository.port.js';
import type { UserRepository } from '../ports/user.repository.port.js';
import { formatRefreshToken, type TokenPair } from '../token-pair.js';

export type LoginInput = {
  email: string;
  password: string;
  ip: string;
};

export class Login {
  constructor(
    private readonly deps: {
      users: UserRepository;
      sessions: SessionRepository;
      passwordHasher: PasswordHasher;
      loginAttemptLimiter: LoginAttemptLimiter;
      tokenGenerator: SecureTokenGenerator;
      accessTokenIssuer: AccessTokenIssuer;
      idGenerator: IdGenerator;
      clock: Clock;
      eventPublisher: EventPublisher;
      sessionTtlMs: number;
    },
  ) {}

  async execute(input: LoginInput): Promise<TokenPair> {
    const { loginAttemptLimiter } = this.deps;

    if (!(await loginAttemptLimiter.registerAttempt(input.ip))) {
      throw new TooManyLoginAttemptsError();
    }

    const email = parseEmail(input.email);

    const lockedUntil = await loginAttemptLimiter.lockedUntil(email);
    if (lockedUntil) throw new AccountLockedError(lockedUntil);

    const user = await this.deps.users.findByEmail(email);
    // Runs even when the user does not exist, so timing does not reveal registered emails.
    const passwordMatches = await this.deps.passwordHasher.verify(
      input.password,
      user?.passwordHash ?? null,
    );

    if (!user || !passwordMatches) {
      await this.registerFailure(email, user);
      throw new InvalidCredentialsError();
    }
    if (user.status === 'disabled') throw new UserDisabledError();

    await loginAttemptLimiter.clearFailures(email);
    return this.startSession(user);
  }

  private async registerFailure(email: Email, user: User | null): Promise<void> {
    // Unknown emails are counted and locked too, so a lockout never reveals that an account exists.
    const lockedUntil = await this.deps.loginAttemptLimiter.registerFailure(email);
    if (lockedUntil && user) {
      await this.deps.eventPublisher.publish([
        { type: 'UserLockedOut', userId: user.id, lockedUntil, occurredAt: this.deps.clock.now() },
      ]);
    }
  }

  private async startSession(user: User): Promise<TokenPair> {
    const refresh = this.deps.tokenGenerator.generate();
    const session = Session.start({
      id: SessionId(this.deps.idGenerator.generate()),
      userId: user.id,
      tokenHash: refresh.hash,
      now: this.deps.clock.now(),
      ttlMs: this.deps.sessionTtlMs,
    });
    await this.deps.sessions.save(session);

    const access = await this.deps.accessTokenIssuer.issue({
      userId: user.id,
      email: user.email.value,
      emailVerified: user.isEmailVerified,
      role: user.role,
    });

    return {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken: formatRefreshToken(session.id, refresh.token),
      refreshTokenExpiresAt: session.expiresAt,
    };
  }
}

/** A malformed email can never match an account, so it is just invalid credentials. */
function parseEmail(raw: string): Email {
  try {
    return Email.create(raw);
  } catch {
    throw new InvalidCredentialsError();
  }
}
