import type { Product } from '#src/domain/entities/product.entity.js';
import { ProductId } from '#src/domain/value-objects/identifiers.js';
import { ProductNotFoundError } from '#src/application/errors/product-not-found.error.js';
import { ProductVersionConflictError } from '#src/application/errors/product-version-conflict.error.js';
import type { ProductRepository } from '#src/application/ports/product.repository.port.js';
import { toProductView, type VersionedProductView } from '#src/application/product.view.js';

/** What every product change gets from its caller: which product, and the version it read. */
export type ProductChangeInput = { productId: string; expectedVersion: number };

/**
 * The flow every product change shares (ADR 0015): load, refuse a stale version, apply the change,
 * and save only if the aggregate recorded something. `change` may throw to abort before the save.
 */
export async function changeProduct(
  products: ProductRepository,
  input: ProductChangeInput,
  change: (product: Product) => void | Promise<void>,
): Promise<VersionedProductView> {
  const found = await products.findById(ProductId(input.productId));
  if (!found) throw new ProductNotFoundError();
  // Fails fast on a stale read, even when the change would be a no-op or invalid. The repository
  // checks again on save, which closes the race between this read and the write.
  if (found.version !== input.expectedVersion) throw new ProductVersionConflictError();
  const { product } = found;

  await change(product);

  // The aggregate records an event only when something changed: no event, no write, and the
  // version stays, so the client's ETag is still valid.
  // Events are recorded but not published until increment 7.
  if (product.pullEvents().length === 0) {
    return { product: toProductView(product), version: found.version };
  }

  const version = await products.save(product, found.version);
  return { product: toProductView(product), version };
}
