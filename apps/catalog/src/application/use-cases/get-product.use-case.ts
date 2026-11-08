import { ProductId } from '#src/domain/value-objects/identifiers.js';
import { ProductNotFoundError } from '#src/application/errors/product-not-found.error.js';
import type { ProductRepository } from '#src/application/ports/product.repository.port.js';
import { toProductView, type VersionedProductView } from '#src/application/product.view.js';

export type GetProductInput = {
  productId: string;
};

/** Admin read: any status. The storefront read (published only) comes in increment 7. */
export class GetProduct {
  constructor(private readonly deps: { products: ProductRepository }) {}

  async execute(input: GetProductInput): Promise<VersionedProductView> {
    const found = await this.deps.products.findById(ProductId(input.productId));
    if (!found) throw new ProductNotFoundError();
    return { product: toProductView(found.product), version: found.version };
  }
}
