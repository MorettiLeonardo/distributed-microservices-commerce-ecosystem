import { DomainError } from '@ecommerce/ddd';

export class SessionRevokedError extends DomainError {
  override readonly code = 'SESSION_REVOKED';

  constructor() {
    super('Session has been revoked');
  }
}

export class SessionExpiredError extends DomainError {
  override readonly code = 'SESSION_EXPIRED';

  constructor() {
    super('Session has expired');
  }
}

/**
 * A refresh token that is no longer the session's current one was presented.
 * The session is revoked BEFORE this is thrown — callers must persist it anyway.
 */
export class RefreshTokenReuseDetectedError extends DomainError {
  override readonly code = 'REFRESH_TOKEN_REUSE_DETECTED';

  constructor() {
    super('Refresh token reuse detected; session revoked');
  }
}
