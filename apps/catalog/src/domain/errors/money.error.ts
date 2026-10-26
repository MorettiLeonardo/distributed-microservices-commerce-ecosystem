import { DomainError } from '@ecommerce/ddd';

export class InvalidMoneyError extends DomainError {
  override readonly code = 'INVALID_MONEY';

  constructor() {
    super('Money must be a non-negative integer amount of cents in BRL');
  }
}
