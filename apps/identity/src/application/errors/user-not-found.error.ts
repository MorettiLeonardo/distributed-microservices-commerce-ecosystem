import { DomainError } from '@ecommerce/ddd';

export class UserNotFoundError extends DomainError {
  override readonly code = 'USER_NOT_FOUND';

  constructor() {
    super('User not found');
  }
}
