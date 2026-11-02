import type { Product } from '../../domain/entities/product.entity.js';
import type { ProductId } from '../../domain/value-objects/identifiers.js';

/**
 * A product and the version it was stored at. The version is a concurrency concept, not a
 * business one, so it travels beside the aggregate instead of inside it.
 */
export type VersionedProduct = { product: Product; version: number };

export interface ProductRepository {
  /** `id` must be a UUID: the column is typed, so inbound adapters validate the shape first. */
  findById(id: ProductId): Promise<VersionedProduct | null>;

  /**
   * Inserts when `expectedVersion` is null, otherwise updates only if the stored version is still
   * `expectedVersion` (optimistic locking). Returns the new version.
   *
   * Throws `ProductVersionConflictError` when another save got there first. A missing category
   * violates a foreign key and is NOT translated: use cases check the category first, so a
   * violation here means a bug.
   */
  save(product: Product, expectedVersion: number | null): Promise<number>;
}
