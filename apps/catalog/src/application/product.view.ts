import type { Product, ProductStatus } from '../domain/entities/product.entity.js';
import type { CategoryId, ProductId, ProductImageId } from '../domain/value-objects/identifiers.js';
import type { Currency } from '../domain/value-objects/money.value-object.js';

/** Plain read model returned by use cases, so inbound adapters never touch the aggregate. */
export type ProductView = {
  id: ProductId;
  categoryId: CategoryId;
  name: string;
  description: string;
  price: { amount: number; currency: Currency } | null;
  weightGrams: number | null;
  images: { id: ProductImageId; key: string }[];
  status: ProductStatus;
  createdAt: Date;
  publishedAt: Date | null;
};

/** What product use cases return: the view plus the version, which HTTP exposes as the ETag. */
export type VersionedProductView = { product: ProductView; version: number };

export const toProductView = (product: Product): ProductView => ({
  id: product.id,
  categoryId: product.categoryId,
  name: product.name,
  description: product.description,
  price: product.price?.toJSON() ?? null,
  weightGrams: product.weightGrams,
  images: product.images.map((image) => ({ id: image.id, key: image.key })),
  status: product.status,
  createdAt: product.createdAt,
  publishedAt: product.publishedAt,
});
