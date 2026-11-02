import { CategoryId, ProductId } from '../../domain/value-objects/identifiers.js';
import { CategoryNotFoundError } from '../errors/category-not-found.error.js';
import { ProductNotFoundError } from '../errors/product-not-found.error.js';
import type { CategoryRepository } from '../ports/category.repository.port.js';
import type { Clock } from '../ports/clock.port.js';
import type { ProductRepository } from '../ports/product.repository.port.js';
import { type ProductView, toProductView } from '../product.view.js';

/** Every field is optional; the ones left out keep their value. */
export type UpdateProductDetailsInput = {
  productId: string;
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

  async execute(input: UpdateProductDetailsInput): Promise<ProductView> {
    const product = await this.deps.products.findById(ProductId(input.productId));
    if (!product) throw new ProductNotFoundError();

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
      input.categoryId !== undefined &&
      !(await this.deps.categories.exists(product.categoryId))
    ) {
      throw new CategoryNotFoundError();
    }

    await this.deps.products.save(product);

    // ProductDetailsUpdated is recorded but not published until increment 7.
    return toProductView(product);
  }
}
