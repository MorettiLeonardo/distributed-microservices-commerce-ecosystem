import { DomainError } from '../../domain/shared/domain-error.js';

export class UserNotFoundError extends DomainError {
  override readonly code = 'USER_NOT_FOUND';

  constructor() {
    super('User not found');
  }
}
