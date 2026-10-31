import type { Product } from '../../domain/entities/product.entity.js';
import type { ProductId } from '../../domain/value-objects/identifiers.js';

export interface ProductRepository {
  /** `id` must be a UUID: the column is typed, so inbound adapters validate the shape first. */
  findById(id: ProductId): Promise<Product | null>;

  /**
   * Upsert. A missing category violates a foreign key and is NOT translated: use cases check the
   * category first, so a violation here means a bug.
   */
  save(product: Product): Promise<void>;
}
