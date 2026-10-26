import type { CategoryId, ProductId, ProductImageId } from '../value-objects/identifiers.js';

/** Plain values only: events are serialized and outlive the domain classes. */
type Price = { readonly amount: number; readonly currency: string };

export type CategoryCreated = {
  readonly type: 'CategoryCreated';
  readonly categoryId: CategoryId;
  readonly name: string;
  readonly occurredAt: Date;
};

export type CategoryEvent = CategoryCreated;

type ProductEventBase = {
  readonly productId: ProductId;
  readonly occurredAt: Date;
};

export type ProductCreated = ProductEventBase & {
  readonly type: 'ProductCreated';
  readonly categoryId: CategoryId;
  readonly name: string;
};

export type ProductDetailsUpdated = ProductEventBase & {
  readonly type: 'ProductDetailsUpdated';
  /** Lets consumers ignore changes they do not care about. */
  readonly changedFields: readonly ProductDetailField[];
};

export type ProductPriceChanged = ProductEventBase & {
  readonly type: 'ProductPriceChanged';
  readonly previous: Price | null;
  readonly current: Price;
};

export type ProductImageAttached = ProductEventBase & {
  readonly type: 'ProductImageAttached';
  readonly imageId: ProductImageId;
};

export type ProductPublished = ProductEventBase & { readonly type: 'ProductPublished' };

export type ProductUnpublished = ProductEventBase & { readonly type: 'ProductUnpublished' };

export type ProductEvent =
  | ProductCreated
  | ProductDetailsUpdated
  | ProductPriceChanged
  | ProductImageAttached
  | ProductPublished
  | ProductUnpublished;

export type CatalogEvent = CategoryEvent | ProductEvent;

export const ProductDetailField = ['name', 'description', 'categoryId', 'weightGrams'] as const;
export type ProductDetailField = (typeof ProductDetailField)[number];
