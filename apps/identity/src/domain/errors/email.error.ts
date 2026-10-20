import { DomainError } from '../shared/domain-error.js';

export class InvalidEmailError extends DomainError {
  override readonly code = 'INVALID_EMAIL';

  constructor() {
    super('Email address is invalid');
  }
}
