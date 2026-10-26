import { DomainError } from '@ecommerce/ddd';

export class InvalidCategoryNameError extends DomainError {
  override readonly code = 'INVALID_CATEGORY_NAME';

  constructor() {
    super('Category name must have 1 to 60 characters');
  }
}
