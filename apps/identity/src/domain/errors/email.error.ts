import { DomainError } from '@ecommerce/ddd';

export class InvalidEmailError extends DomainError {
  override readonly code = 'INVALID_EMAIL';

  constructor() {
    super('Email address is invalid');
  }
}
