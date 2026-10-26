import { RefreshTokenReuseDetectedError } from '../../domain/errors/session.error.js';
import { InvalidRefreshTokenError } from '../errors/authentication.error.js';
import type { AccessTokenIssuer } from '../ports/access-token-issuer.port.js';
import type { Clock } from '../ports/clock.port.js';
import type { SecureTokenGenerator } from '../ports/secure-token-generator.port.js';
import type { SessionRepository } from '../ports/session.repository.port.js';
import type { UserRepository } from '../ports/user.repository.port.js';
import { formatRefreshToken, parseRefreshToken, type TokenPair } from '../token-pair.js';

export type RefreshSessionInput = {
  refreshToken: string;
};

export class RefreshSession {
  constructor(
    private readonly deps: {
      users: UserRepository;
      sessions: SessionRepository;
      tokenGenerator: SecureTokenGenerator;
      accessTokenIssuer: AccessTokenIssuer;
      clock: Clock;
    },
  ) {}

  async execute(input: RefreshSessionInput): Promise<TokenPair> {
    const parsed = parseRefreshToken(input.refreshToken);
    if (!parsed) throw new InvalidRefreshTokenError();

    const session = await this.deps.sessions.findById(parsed.sessionId);
    if (!session) throw new InvalidRefreshTokenError();

    const next = this.deps.tokenGenerator.generate();
    try {
      session.rotate({
        presentedHash: this.deps.tokenGenerator.hash(parsed.secret),
        newHash: next.hash,
        now: this.deps.clock.now(),
      });
    } catch (error) {
      // On reuse, rotate() revokes the session before throwing: that revocation MUST be persisted,
      // otherwise the attacker keeps a working session.
      if (error instanceof RefreshTokenReuseDetectedError) await this.deps.sessions.save(session);
      throw error;
    }

    const user = await this.deps.users.findById(session.userId);
    if (!user || user.status === 'disabled') throw new InvalidRefreshTokenError();

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
      refreshToken: formatRefreshToken(session.id, next.token),
      refreshTokenExpiresAt: session.expiresAt,
    };
  }
}
