import {
  RefreshTokenReuseDetectedError,
  SessionExpiredError,
  SessionRevokedError,
} from '../errors/session.error.js';
import type { SessionId, TokenHash, UserId } from '../value-objects/identifiers.js';

export type SessionProps = {
  id: SessionId;
  userId: UserId;
  currentTokenHash: TokenHash;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
};

/**
 * A refresh-token family created at login. Expiry is absolute:
 * rotating the refresh token does not extend the session.
 */
export class Session {
  private constructor(private props: SessionProps) {}

  static start(input: {
    id: SessionId;
    userId: UserId;
    tokenHash: TokenHash;
    now: Date;
    ttlMs: number;
  }): Session {
    return new Session({
      id: input.id,
      userId: input.userId,
      currentTokenHash: input.tokenHash,
      createdAt: input.now,
      expiresAt: new Date(input.now.getTime() + input.ttlMs),
      revokedAt: null,
    });
  }

  static restore(props: SessionProps): Session {
    return new Session({ ...props });
  }

  get id(): SessionId {
    return this.props.id;
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get currentTokenHash(): TokenHash {
    return this.props.currentTokenHash;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get revokedAt(): Date | null {
    return this.props.revokedAt;
  }

  isExpired(now: Date): boolean {
    return now.getTime() >= this.props.expiresAt.getTime();
  }

  /**
   * Replaces the current refresh token with a new one.
   * Presenting a token that is not the current one means it was already used — possibly stolen —
   * so the whole session is revoked and `RefreshTokenReuseDetectedError` is thrown.
   */
  rotate(input: { presentedHash: TokenHash; newHash: TokenHash; now: Date }): void {
    if (this.props.revokedAt) throw new SessionRevokedError();
    if (this.isExpired(input.now)) throw new SessionExpiredError();

    if (input.presentedHash !== this.props.currentTokenHash) {
      this.revoke(input.now);
      throw new RefreshTokenReuseDetectedError();
    }

    this.props = { ...this.props, currentTokenHash: input.newHash };
  }

  /** Idempotent: keeps the original revocation time. */
  revoke(now: Date): void {
    if (this.props.revokedAt) return;
    this.props = { ...this.props, revokedAt: now };
  }
}
