import { DomainError } from '../shared/domain-error.js';

export class UserDisabledError extends DomainError {
  override readonly code = 'USER_DISABLED';

  constructor() {
    super('User is disabled');
  }
}
