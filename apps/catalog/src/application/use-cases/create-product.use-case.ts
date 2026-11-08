import { Product } from '#src/domain/entities/product.entity.js';
import { CategoryId, ProductId } from '#src/domain/value-objects/identifiers.js';
import { Money } from '#src/domain/value-objects/money.value-object.js';
import { CategoryNotFoundError } from '#src/application/errors/category-not-found.error.js';
import type { CategoryRepository } from '#src/application/ports/category.repository.port.js';
import type { Clock } from '#src/application/ports/clock.port.js';
import type { IdGenerator } from '#src/application/ports/id-generator.port.js';
import type { ProductRepository } from '#src/application/ports/product.repository.port.js';
import { toProductView, type VersionedProductView } from '#src/application/product.view.js';

/** Optional fields accept an explicit `undefined`, which is what Zod's `.optional()` yields. */
export type CreateProductInput = {
  categoryId: string;
  name: string;
  description?: string | undefined;
  price?: { amount: number; currency?: string | undefined } | undefined;
  weightGrams?: number | undefined;
};

export class CreateProduct {
  constructor(
    private readonly deps: {
      categories: CategoryRepository;
      products: ProductRepository;
      idGenerator: IdGenerator;
      clock: Clock;
    },
  ) {}

  /** Creates a draft. Throws `CategoryNotFoundError` when the category does not exist. */
  async execute(input: CreateProductInput): Promise<VersionedProductView> {
    // Built first: invalid details fail without any I/O.
    const product = Product.create({
      id: ProductId(this.deps.idGenerator.generate()),
      categoryId: CategoryId(input.categoryId),
      name: input.name,
      ...(input.description !== undefined && { description: input.description }),
      ...(input.price !== undefined && {
        price: Money.of(input.price.amount, input.price.currency),
      }),
      ...(input.weightGrams !== undefined && { weightGrams: input.weightGrams }),
      now: this.deps.clock.now(),
    });

    // Unlike the category name, this lookup is the rule itself: categories are never deleted,
    // so no race can make it stale. The foreign key only guards against bugs.
    if (!(await this.deps.categories.exists(product.categoryId))) {
      throw new CategoryNotFoundError();
    }

    const version = await this.deps.products.save(product, null);

    // ProductCreated is recorded but not published until increment 7, like CategoryCreated.
    return { product: toProductView(product), version };
  }
}
