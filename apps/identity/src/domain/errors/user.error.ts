import { DomainError } from '@ecommerce/ddd';

export class UserDisabledError extends DomainError {
  override readonly code = 'USER_DISABLED';

  constructor() {
    super('User is disabled');
  }
}

export class EmailNotVerifiedError extends DomainError {
  override readonly code = 'EMAIL_NOT_VERIFIED';

  constructor() {
    super('User email is not verified');
  }
}
