import { DomainError } from '@ecommerce/ddd';

export class OneTimeTokenExpiredError extends DomainError {
  override readonly code = 'ONE_TIME_TOKEN_EXPIRED';

  constructor() {
    super('Token has expired');
  }
}

export class OneTimeTokenAlreadyConsumedError extends DomainError {
  override readonly code = 'ONE_TIME_TOKEN_ALREADY_CONSUMED';

  constructor() {
    super('Token has already been used');
  }
}
