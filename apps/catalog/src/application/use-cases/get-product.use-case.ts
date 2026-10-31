import { ProductId } from '../../domain/value-objects/identifiers.js';
import { ProductNotFoundError } from '../errors/product-not-found.error.js';
import type { ProductRepository } from '../ports/product.repository.port.js';
import { type ProductView, toProductView } from '../product.view.js';

export type GetProductInput = {
  productId: string;
};

/** Admin read: any status. The storefront read (published only) comes in increment 7. */
export class GetProduct {
  constructor(private readonly deps: { products: ProductRepository }) {}

  async execute(input: GetProductInput): Promise<ProductView> {
    const product = await this.deps.products.findById(ProductId(input.productId));
    if (!product) throw new ProductNotFoundError();
    return toProductView(product);
  }
}
