import { DomainError } from '@ecommerce/ddd';

/** Raised by the category repository: names are unique ignoring case (UNIQUE index). */
export class CategoryNameTakenError extends DomainError {
  override readonly code = 'CATEGORY_NAME_TAKEN';

  constructor() {
    super('A category with this name already exists');
  }
}
