import type { Clock } from '../ports/clock.port.js';
import type { ProductRepository } from '../ports/product.repository.port.js';
import type { VersionedProductView } from '../product.view.js';
import { changeProduct, type ProductChangeInput } from './change-product.js';

/** Puts a product on the storefront. Throws `ProductNotPublishableError` listing what is missing. */
export class PublishProduct {
  constructor(private readonly deps: { products: ProductRepository; clock: Clock }) {}

  execute(input: ProductChangeInput): Promise<VersionedProductView> {
    return changeProduct(this.deps.products, input, (product) => {
      product.publish(this.deps.clock.now());
    });
  }
}
