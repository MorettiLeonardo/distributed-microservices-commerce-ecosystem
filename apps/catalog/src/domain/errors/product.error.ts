import { DomainError } from '@ecommerce/ddd';

export class InvalidProductNameError extends DomainError {
  override readonly code = 'INVALID_PRODUCT_NAME';

  constructor() {
    super('Product name must have 1 to 120 characters');
  }
}

export class InvalidProductDescriptionError extends DomainError {
  override readonly code = 'INVALID_PRODUCT_DESCRIPTION';

  constructor() {
    super('Product description must have at most 5000 characters');
  }
}

export class InvalidPriceError extends DomainError {
  override readonly code = 'INVALID_PRICE';

  constructor() {
    super('Product price must be greater than zero');
  }
}

export class InvalidWeightError extends DomainError {
  override readonly code = 'INVALID_WEIGHT';

  constructor() {
    super('Product weight must be a whole number of grams between 1 and 100000');
  }
}

export class TooManyImagesError extends DomainError {
  override readonly code = 'TOO_MANY_IMAGES';

  constructor(readonly limit: number) {
    super(`A product can have at most ${limit} images`);
  }
}

/** What a product still lacks to be published (K2). */
export type PublishRequirement = 'price' | 'weight' | 'image';

export class ProductNotPublishableError extends DomainError {
  override readonly code = 'PRODUCT_NOT_PUBLISHABLE';

  constructor(readonly missing: readonly PublishRequirement[]) {
    super(`Product cannot be published, missing: ${missing.join(', ')}`);
  }
}

export class ProductNotPublishedError extends DomainError {
  override readonly code = 'PRODUCT_NOT_PUBLISHED';

  constructor() {
    super('Only a published product can be unpublished');
  }
}
