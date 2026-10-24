import { DomainError } from '../../domain/shared/domain-error.js';

/**
 * Raised by the user repository when saving would duplicate an email. `RegisterUser` checks
 * first, so this only happens when two registrations for the same email race each other.
 */
export class EmailAlreadyRegisteredError extends DomainError {
  override readonly code = 'EMAIL_ALREADY_REGISTERED';

  constructor() {
    super('Email is already registered');
  }
}
