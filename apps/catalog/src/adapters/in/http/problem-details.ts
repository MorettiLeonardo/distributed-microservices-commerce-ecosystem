import { createProblemDetailsHandler } from '@ecommerce/http';
import type { ErrorRequestHandler } from 'express';
import type { CategoryNameTakenError } from '../../../application/errors/category-name-taken.error.js';
import type { CategoryNotFoundError } from '../../../application/errors/category-not-found.error.js';
import type { ProductNotFoundError } from '../../../application/errors/product-not-found.error.js';
import type { InvalidCategoryNameError } from '../../../domain/errors/category.error.js';
import type { InvalidMoneyError } from '../../../domain/errors/money.error.js';
import type {
  InvalidPriceError,
  InvalidProductDescriptionError,
  InvalidProductNameError,
  InvalidWeightError,
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
  | ProductNotFoundError;

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
};

/** Last middleware: catalog's domain errors on top of the shared RFC 9457 handling. */
export const problemDetailsHandler: ErrorRequestHandler = createProblemDetailsHandler({
  statusByCode: STATUS_BY_CODE,
});
