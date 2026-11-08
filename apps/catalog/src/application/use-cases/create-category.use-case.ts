import { Category } from '#src/domain/entities/category.entity.js';
import { CategoryId } from '#src/domain/value-objects/identifiers.js';
import { type CategoryView, toCategoryView } from '#src/application/category.view.js';
import type { CategoryRepository } from '#src/application/ports/category.repository.port.js';
import type { Clock } from '#src/application/ports/clock.port.js';
import type { IdGenerator } from '#src/application/ports/id-generator.port.js';

export type CreateCategoryInput = {
  name: string;
};

export class CreateCategory {
  constructor(
    private readonly deps: {
      categories: CategoryRepository;
      idGenerator: IdGenerator;
      clock: Clock;
    },
  ) {}

  /** Throws `CategoryNameTakenError` when the name is taken, in any case. */
  async execute(input: CreateCategoryInput): Promise<CategoryView> {
    const category = Category.create({
      id: CategoryId(this.deps.idGenerator.generate()),
      name: input.name,
      now: this.deps.clock.now(),
    });

    // No lookup before saving: a duplicate would fail the same way, and only the UNIQUE index
    // also covers two creations racing each other.
    await this.deps.categories.save(category);

    // CategoryCreated is recorded by the aggregate but not published yet: catalog events go out
    // on SNS in increment 7, when they get a consumer.
    return toCategoryView(category);
  }
}
