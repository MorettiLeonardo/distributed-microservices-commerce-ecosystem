import { CategoryNameTakenError } from '../../src/application/errors/category-name-taken.error.js';
import type { CategoryRepository } from '../../src/application/ports/category.repository.port.js';
import type { Category, CategoryProps } from '../../src/domain/entities/category.entity.js';

type Tables = {
  categories: Map<string, CategoryProps>;
};

/**
 * Test double for the Postgres adapter. Stores COPIES of aggregate state, like a real database
 * would, and mimics the case-insensitive UNIQUE index on category names.
 */
export class InMemoryDatabase {
  tables: Tables = { categories: new Map() };

  readonly repositories: { categories: CategoryRepository } = {
    categories: new InMemoryCategoryRepository(this),
  };
}

class InMemoryCategoryRepository implements CategoryRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  async save(category: Category): Promise<void> {
    // Mimics the UNIQUE index on lower(categories.name).
    for (const props of this.db.tables.categories.values()) {
      if (props.id !== category.id && sameName(props.name, category.name)) {
        throw new CategoryNameTakenError();
      }
    }
    this.db.tables.categories.set(category.id, {
      id: category.id,
      name: category.name,
      createdAt: new Date(category.createdAt),
    });
  }
}

const sameName = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();
