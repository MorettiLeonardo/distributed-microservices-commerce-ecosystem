import type { Clock } from '#src/application/ports/clock.port.js';
import type { ProductRepository } from '#src/application/ports/product.repository.port.js';
import type { VersionedProductView } from '#src/application/product.view.js';
import { changeProduct, type ProductChangeInput } from './change-product.js';

/** Takes a product off the storefront (never deleted, K1). Throws `ProductNotPublishedError` for a draft. */
export class UnpublishProduct {
  constructor(private readonly deps: { products: ProductRepository; clock: Clock }) {}

  execute(input: ProductChangeInput): Promise<VersionedProductView> {
    return changeProduct(this.deps.products, input, (product) => {
      product.unpublish(this.deps.clock.now());
    });
  }
}
