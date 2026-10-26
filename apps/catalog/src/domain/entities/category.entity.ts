import { AggregateRoot } from '@ecommerce/ddd';
import { InvalidCategoryNameError } from '../errors/category.error.js';
import type { CategoryEvent } from '../events/catalog.events.js';
import type { CategoryId } from '../value-objects/identifiers.js';

const MAX_NAME_LENGTH = 60;

export type CategoryProps = {
  id: CategoryId;
  name: string;
  createdAt: Date;
};

/**
 * A flat grouping of products for the storefront filter (K9). Name uniqueness spans every
 * category, so it is enforced by the database and the use case, not by this aggregate.
 */
export class Category extends AggregateRoot<CategoryEvent> {
  private constructor(private readonly props: CategoryProps) {
    super();
  }

  /** Emits `CategoryCreated`. */
  static create(input: { id: CategoryId; name: string; now: Date }): Category {
    const name = input.name.trim();
    if (name.length === 0 || name.length > MAX_NAME_LENGTH) throw new InvalidCategoryNameError();

    const category = new Category({ id: input.id, name, createdAt: input.now });
    category.record({
      type: 'CategoryCreated',
      categoryId: input.id,
      name,
      occurredAt: input.now,
    });
    return category;
  }

  /** Rebuilds a category from persistence. Emits nothing. */
  static restore(props: CategoryProps): Category {
    return new Category({ ...props });
  }

  get id(): CategoryId {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
