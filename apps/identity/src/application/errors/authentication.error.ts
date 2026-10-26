import { DomainError } from '@ecommerce/ddd';

/** Deliberately vague: never says whether the email or the password was wrong. */
export class InvalidCredentialsError extends DomainError {
  override readonly code = 'INVALID_CREDENTIALS';

  constructor() {
    super('Invalid email or password');
  }
}

export class TooManyLoginAttemptsError extends DomainError {
  override readonly code = 'TOO_MANY_LOGIN_ATTEMPTS';

  constructor() {
    super('Too many login attempts; try again later');
  }
}

export class AccountLockedError extends DomainError {
  override readonly code = 'ACCOUNT_LOCKED';

  constructor(readonly lockedUntil: Date) {
    super('Account temporarily locked after repeated failed logins');
  }
}

export class InvalidRefreshTokenError extends DomainError {
  override readonly code = 'INVALID_REFRESH_TOKEN';

  constructor() {
    super('Refresh token is invalid');
  }
}

export class InvalidOneTimeTokenError extends DomainError {
  override readonly code = 'INVALID_ONE_TIME_TOKEN';

  constructor() {
    super('Token is invalid');
  }
}
