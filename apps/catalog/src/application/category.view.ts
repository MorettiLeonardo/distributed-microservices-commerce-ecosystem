import type { Category } from '../domain/entities/category.entity.js';
import type { CategoryId } from '../domain/value-objects/identifiers.js';

/** Plain read model returned by use cases, so inbound adapters never touch the aggregate. */
export type CategoryView = {
  id: CategoryId;
  name: string;
  createdAt: Date;
};

export const toCategoryView = (category: Category): CategoryView => ({
  id: category.id,
  name: category.name,
  createdAt: category.createdAt,
});
