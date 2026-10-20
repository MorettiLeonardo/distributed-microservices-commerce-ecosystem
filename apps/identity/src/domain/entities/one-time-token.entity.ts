import {
  OneTimeTokenAlreadyConsumedError,
  OneTimeTokenExpiredError,
} from '../errors/one-time-token.error.js';
import type { OneTimeTokenId, TokenHash, UserId } from '../value-objects/identifiers.js';

export const OneTimeTokenPurpose = ['email_verification', 'password_reset'] as const;
export type OneTimeTokenPurpose = (typeof OneTimeTokenPurpose)[number];

const HOUR_MS = 60 * 60 * 1000;

/** How long each kind of token stays valid — a business rule, so it lives in the domain. */
export const ONE_TIME_TOKEN_TTL_MS: Record<OneTimeTokenPurpose, number> = {
  email_verification: 24 * HOUR_MS,
  password_reset: 30 * 60 * 1000,
};

export type OneTimeTokenProps = {
  id: OneTimeTokenId;
  userId: UserId;
  purpose: OneTimeTokenPurpose;
  tokenHash: TokenHash;
  createdAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
};

export class OneTimeToken {
  private constructor(private props: OneTimeTokenProps) {}

  static issue(input: {
    id: OneTimeTokenId;
    userId: UserId;
    purpose: OneTimeTokenPurpose;
    tokenHash: TokenHash;
    now: Date;
  }): OneTimeToken {
    return new OneTimeToken({
      id: input.id,
      userId: input.userId,
      purpose: input.purpose,
      tokenHash: input.tokenHash,
      createdAt: input.now,
      expiresAt: new Date(input.now.getTime() + ONE_TIME_TOKEN_TTL_MS[input.purpose]),
      consumedAt: null,
    });
  }

  static restore(props: OneTimeTokenProps): OneTimeToken {
    return new OneTimeToken({ ...props });
  }

  get id(): OneTimeTokenId {
    return this.props.id;
  }

  get userId(): UserId {
    return this.props.userId;
  }

  get purpose(): OneTimeTokenPurpose {
    return this.props.purpose;
  }

  get tokenHash(): TokenHash {
    return this.props.tokenHash;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get consumedAt(): Date | null {
    return this.props.consumedAt;
  }

  consume(now: Date): void {
    if (this.props.consumedAt) throw new OneTimeTokenAlreadyConsumedError();
    if (now.getTime() >= this.props.expiresAt.getTime()) throw new OneTimeTokenExpiredError();
    this.props = { ...this.props, consumedAt: now };
  }
}
