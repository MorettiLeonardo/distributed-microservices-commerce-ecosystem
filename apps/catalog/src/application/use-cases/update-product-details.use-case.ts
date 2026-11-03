import { CategoryId } from '../../domain/value-objects/identifiers.js';
import { CategoryNotFoundError } from '../errors/category-not-found.error.js';
import type { CategoryRepository } from '../ports/category.repository.port.js';
import type { Clock } from '../ports/clock.port.js';
import type { ProductRepository } from '../ports/product.repository.port.js';
import type { VersionedProductView } from '../product.view.js';
import { changeProduct, type ProductChangeInput } from './change-product.js';

/** Every detail is optional; the ones left out keep their value. */
export type UpdateProductDetailsInput = ProductChangeInput & {
  name?: string | undefined;
  description?: string | undefined;
  categoryId?: string | undefined;
  weightGrams?: number | undefined;
};

export class UpdateProductDetails {
  constructor(
    private readonly deps: {
      categories: CategoryRepository;
      products: ProductRepository;
      clock: Clock;
    },
  ) {}

  execute(input: UpdateProductDetailsInput): Promise<VersionedProductView> {
    return changeProduct(this.deps.products, input, async (product) => {
      const previousCategory = product.categoryId;
      // The aggregate validates and records the change in memory; nothing is stored until save.
      product.updateDetails(
        {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.categoryId !== undefined && { categoryId: CategoryId(input.categoryId) }),
          ...(input.weightGrams !== undefined && { weightGrams: input.weightGrams }),
        },
        this.deps.clock.now(),
      );

      if (
        product.categoryId !== previousCategory &&
        !(await this.deps.categories.exists(product.categoryId))
      ) {
        throw new CategoryNotFoundError();
      }
    });
  }
}
