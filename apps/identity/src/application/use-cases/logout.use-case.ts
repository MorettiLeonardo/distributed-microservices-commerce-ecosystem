import type { Clock } from '../ports/clock.port.js';
import type { SecureTokenGenerator } from '../ports/secure-token-generator.port.js';
import type { SessionRepository } from '../ports/session.repository.port.js';
import { parseRefreshToken } from '../token-pair.js';

export type LogoutInput = {
  refreshToken: string;
};

export class Logout {
  constructor(
    private readonly deps: {
      sessions: SessionRepository;
      tokenGenerator: SecureTokenGenerator;
      clock: Clock;
    },
  ) {}

  /** Idempotent: malformed, unknown or stale tokens are ignored, so logout always succeeds. */
  async execute(input: LogoutInput): Promise<void> {
    const parsed = parseRefreshToken(input.refreshToken);
    if (!parsed) return;

    const session = await this.deps.sessions.findById(parsed.sessionId);
    // Only the current token may end the session; a stale one must not log the real user out.
    if (!session || session.currentTokenHash !== this.deps.tokenGenerator.hash(parsed.secret)) {
      return;
    }

    session.revoke(this.deps.clock.now());
    await this.deps.sessions.save(session);
  }
}
