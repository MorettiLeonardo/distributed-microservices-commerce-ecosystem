import { Money } from '../../domain/value-objects/money.value-object.js';
import type { Clock } from '../ports/clock.port.js';
import type { ProductRepository } from '../ports/product.repository.port.js';
import type { VersionedProductView } from '../product.view.js';
import { changeProduct, type ProductChangeInput } from './change-product.js';

export type ChangeProductPriceInput = ProductChangeInput & {
  price: { amount: number; currency?: string | undefined };
};

/** Its own use case (and event, `ProductPriceChanged`): price changes matter to carts and orders. */
export class ChangeProductPrice {
  constructor(private readonly deps: { products: ProductRepository; clock: Clock }) {}

  execute(input: ChangeProductPriceInput): Promise<VersionedProductView> {
    return changeProduct(this.deps.products, input, (product) => {
      product.changePrice(
        Money.of(input.price.amount, input.price.currency),
        this.deps.clock.now(),
      );
    });
  }
}
