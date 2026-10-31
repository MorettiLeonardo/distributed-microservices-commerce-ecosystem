import { DomainError } from '@ecommerce/ddd';

/** Raised by use cases when a product references a category that does not exist. */
export class CategoryNotFoundError extends DomainError {
  override readonly code = 'CATEGORY_NOT_FOUND';

  constructor() {
    super('The referenced category does not exist');
  }
}
