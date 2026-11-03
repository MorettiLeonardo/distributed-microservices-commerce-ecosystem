import type { DomainError } from '@ecommerce/ddd';
import { createProblemDetailsHandler, type ProblemExtras } from '@ecommerce/http';
import type { ErrorRequestHandler } from 'express';
import type { CategoryNameTakenError } from '../../../application/errors/category-name-taken.error.js';
import type { CategoryNotFoundError } from '../../../application/errors/category-not-found.error.js';
import type { ProductNotFoundError } from '../../../application/errors/product-not-found.error.js';
import type { ProductVersionConflictError } from '../../../application/errors/product-version-conflict.error.js';
import type { InvalidCategoryNameError } from '../../../domain/errors/category.error.js';
import type { InvalidMoneyError } from '../../../domain/errors/money.error.js';
import {
  type InvalidPriceError,
  type InvalidProductDescriptionError,
  type InvalidProductNameError,
  type InvalidWeightError,
  ProductNotPublishableError,
  type ProductNotPublishedError,
} from '../../../domain/errors/product.error.js';

/** Union of the domain errors the API exposes; grows with the domain. */
type KnownDomainError =
  | InvalidCategoryNameError
  | CategoryNameTakenError
  | CategoryNotFoundError
  | InvalidProductNameError
  | InvalidProductDescriptionError
  | InvalidPriceError
  | InvalidMoneyError
  | InvalidWeightError
  | ProductNotFoundError
  | ProductVersionConflictError
  | ProductNotPublishableError
  | ProductNotPublishedError;

/** Adding an error to the union above without a status here is a compile error. */
const STATUS_BY_CODE: Record<KnownDomainError['code'], number> = {
  INVALID_CATEGORY_NAME: 422,
  CATEGORY_NAME_TAKEN: 409,
  // A category in the body, not in the URL: invalid input, not a missing resource.
  CATEGORY_NOT_FOUND: 422,
  INVALID_PRODUCT_NAME: 422,
  INVALID_PRODUCT_DESCRIPTION: 422,
  INVALID_PRICE: 422,
  INVALID_MONEY: 422,
  INVALID_WEIGHT: 422,
  PRODUCT_NOT_FOUND: 404,
  // Only changes carry If-Match, and a stale one is what this error means.
  PRODUCT_VERSION_CONFLICT: 412,
  // Lifecycle actions have no body: what refuses them is the product's current state (409),
  // not invalid request content (422).
  PRODUCT_NOT_PUBLISHABLE: 409,
  PRODUCT_NOT_PUBLISHED: 409,
};

function extras(error: DomainError): ProblemExtras {
  if (error instanceof ProductNotPublishableError) {
    return { extensions: { missing: error.missing } };
  }
  return {};
}

/** Last middleware: catalog's domain errors on top of the shared RFC 9457 handling. */
export const problemDetailsHandler: ErrorRequestHandler = createProblemDetailsHandler({
  statusByCode: STATUS_BY_CODE,
  extras,
});
