import { CategoryNameTakenError } from '#src/application/errors/category-name-taken.error.js';
import type { CategoryRepository } from '#src/application/ports/category.repository.port.js';
import type { ImageUploadRepository } from '#src/application/ports/image-upload.repository.port.js';
import { ProductVersionConflictError } from '#src/application/errors/product-version-conflict.error.js';
import type {
  ProductRepository,
  VersionedProduct,
} from '#src/application/ports/product.repository.port.js';
import type { Category, CategoryProps } from '#src/domain/entities/category.entity.js';
import type { ImageUpload, ImageUploadProps } from '#src/domain/entities/image-upload.entity.js';
import { Product, type ProductProps } from '#src/domain/entities/product.entity.js';
import {
  type CategoryId,
  type ProductId,
  ProductImageId,
} from '#src/domain/value-objects/identifiers.js';

type Tables = {
  categories: Map<string, CategoryProps>;
  products: Map<string, ProductProps & { version: number }>;
  imageUploads: Map<string, ImageUploadProps>;
};

/**
 * Test double for the Postgres adapter. Stores COPIES of aggregate state, like a real database
 * would, and mimics its constraints: the case-insensitive UNIQUE index on category names, the
 * foreign keys from products to categories and from image uploads to products, and the products'
 * optimistic locking.
 */
export class InMemoryDatabase {
  tables: Tables = { categories: new Map(), products: new Map(), imageUploads: new Map() };

  readonly repositories: {
    categories: CategoryRepository;
    products: ProductRepository;
    imageUploads: ImageUploadRepository;
  } = {
    categories: new InMemoryCategoryRepository(this),
    products: new InMemoryProductRepository(this),
    imageUploads: new InMemoryImageUploadRepository(this),
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

  async findById(id: ProductId): Promise<VersionedProduct | null> {
    const row = this.db.tables.products.get(id);
    if (!row) return null;
    const { version, ...props } = row;
    return { product: Product.restore({ ...props, images: [...props.images] }), version };
  }

  async save(product: Product, expectedVersion: number | null): Promise<number> {
    // Mimics the foreign key: a plain error, like the untranslated one from Postgres.
    if (!this.db.tables.categories.has(product.categoryId)) {
      throw new Error('foreign key violation: products.category_id');
    }
    const stored = this.db.tables.products.get(product.id);
    if (expectedVersion === null && stored) {
      throw new Error('primary key violation: products.id');
    }
    // Mimics `UPDATE ... WHERE version = expectedVersion` matching no row.
    if (expectedVersion !== null && stored?.version !== expectedVersion) {
      throw new ProductVersionConflictError();
    }
    const version = (expectedVersion ?? 0) + 1;
    this.db.tables.products.set(product.id, {
      version,
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
    return version;
  }
}

class InMemoryImageUploadRepository implements ImageUploadRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  async save(upload: ImageUpload): Promise<void> {
    if (!this.db.tables.products.has(upload.productId)) {
      throw new Error('foreign key violation: image_uploads.product_id');
    }
    this.db.tables.imageUploads.set(upload.id, {
      id: upload.id,
      productId: upload.productId,
      contentType: upload.contentType,
      status: upload.status,
      requestedAt: new Date(upload.requestedAt),
      expiresAt: new Date(upload.expiresAt),
    });
  }

  /** Mimics `WHERE product_id = ? AND status = 'pending' AND expires_at > now`. */
  async countOpen(productId: ProductId, now: Date): Promise<number> {
    return [...this.db.tables.imageUploads.values()].filter(
      (row) => row.productId === productId && row.status === 'pending' && row.expiresAt > now,
    ).length;
  }
}

const sameName = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/**
 * Writes an image straight into a stored product, behind the use cases, like a fixture row in a
 * database. Stands in for `attachImage` until a use case exposes it (increment 6).
 */
export function seedImage(db: InMemoryDatabase, productId: string): void {
  const row = db.tables.products.get(productId);
  if (!row) throw new Error(`No product ${productId} to seed an image into`);
  const id = ProductImageId(`${productId.slice(0, -2)}99`);
  row.images = [...row.images, { id, key: `products/${productId}/${id}.webp` }];
}
