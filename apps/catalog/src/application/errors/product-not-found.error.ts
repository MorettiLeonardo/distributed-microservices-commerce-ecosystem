import { DomainError } from '@ecommerce/ddd';

export class ProductNotFoundError extends DomainError {
  override readonly code = 'PRODUCT_NOT_FOUND';

  constructor() {
    super('Product not found');
  }
}
