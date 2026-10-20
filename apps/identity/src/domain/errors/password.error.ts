import { DomainError } from '../shared/domain-error.js';

export class PasswordTooShortError extends DomainError {
  override readonly code = 'PASSWORD_TOO_SHORT';

  constructor(minLength: number) {
    super(`Password must have at least ${minLength} characters`);
  }
}

export class PasswordTooLongError extends DomainError {
  override readonly code = 'PASSWORD_TOO_LONG';

  constructor(maxBytes: number) {
    super(`Password must have at most ${maxBytes} bytes`);
  }
}
