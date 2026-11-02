import { DomainError } from '@ecommerce/ddd';

/**
 * The product changed since the version the caller based its change on (optimistic locking).
 * Raised when the client's `If-Match` is stale, or by the repository when another save won.
 */
export class ProductVersionConflictError extends DomainError {
  override readonly code = 'PRODUCT_VERSION_CONFLICT';

  constructor() {
    super('The product was changed by someone else; reload it and try again');
  }
}
