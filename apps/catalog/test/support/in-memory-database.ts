import { CategoryNameTakenError } from '../../src/application/errors/category-name-taken.error.js';
import type { CategoryRepository } from '../../src/application/ports/category.repository.port.js';
import type { ProductRepository } from '../../src/application/ports/product.repository.port.js';
import type { Category, CategoryProps } from '../../src/domain/entities/category.entity.js';
import { Product, type ProductProps } from '../../src/domain/entities/product.entity.js';
import type { CategoryId, ProductId } from '../../src/domain/value-objects/identifiers.js';

type Tables = {
  categories: Map<string, CategoryProps>;
  products: Map<string, ProductProps>;
};

/**
 * Test double for the Postgres adapter. Stores COPIES of aggregate state, like a real database
 * would, and mimics its constraints: the case-insensitive UNIQUE index on category names and the
 * foreign key from products to categories.
 */
export class InMemoryDatabase {
  tables: Tables = { categories: new Map(), products: new Map() };

  readonly repositories: { categories: CategoryRepository; products: ProductRepository } = {
    categories: new InMemoryCategoryRepository(this),
    products: new InMemoryProductRepository(this),
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

  async exists(id: CategoryId): Promise<boolean> {
    return this.db.tables.categories.has(id);
  }
}

class InMemoryProductRepository implements ProductRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  async findById(id: ProductId): Promise<Product | null> {
    const props = this.db.tables.products.get(id);
    return props ? Product.restore({ ...props, images: [...props.images] }) : null;
  }

  async save(product: Product): Promise<void> {
    // Mimics the foreign key: a plain error, like the untranslated one from Postgres.
    if (!this.db.tables.categories.has(product.categoryId)) {
      throw new Error('foreign key violation: products.category_id');
    }
    this.db.tables.products.set(product.id, {
      id: product.id,
      categoryId: product.categoryId,
      name: product.name,
      description: product.description,
      price: product.price,
      weightGrams: product.weightGrams,
      images: product.images,
      status: product.status,
      createdAt: new Date(product.createdAt),
      publishedAt: product.publishedAt && new Date(product.publishedAt),
    });
  }
}

const sameName = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();
