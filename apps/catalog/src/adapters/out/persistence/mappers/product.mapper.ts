import { Product, ProductStatus } from '../../../../domain/entities/product.entity.js';
import {
  CategoryId,
  ProductId,
  ProductImageId,
} from '../../../../domain/value-objects/identifiers.js';
import { Money } from '../../../../domain/value-objects/money.value-object.js';
import type { ProductModel } from '../models/product.model.js';

export const ProductMapper = {
  /** `row` must be loaded with its images. */
  toDomain(row: ProductModel): Product {
    if (!row.images) throw new Error('Product loaded without its images');
    return Product.restore({
      id: ProductId(row.id),
      categoryId: CategoryId(row.categoryId),
      name: row.name,
      description: row.description,
      // The CHECK constraint guarantees both columns are null or both are set.
      price: row.priceAmount === null ? null : Money.of(row.priceAmount, row.priceCurrency ?? ''),
      weightGrams: row.weightGrams,
      images: row.images
        .toSorted((a, b) => a.position - b.position)
        .map((image) => ({ id: ProductImageId(image.id), key: image.key })),
      status: parseStatus(row.status),
      createdAt: row.createdAt,
      publishedAt: row.publishedAt,
    });
  },

  toPersistence(product: Product) {
    return {
      id: product.id,
      categoryId: product.categoryId,
      name: product.name,
      description: product.description,
      priceAmount: product.price?.amount ?? null,
      priceCurrency: product.price?.currency ?? null,
      weightGrams: product.weightGrams,
      status: product.status,
      createdAt: product.createdAt,
      publishedAt: product.publishedAt,
    };
  },

  imagesToPersistence(product: Product) {
    return product.images.map((image, position) => ({
      id: image.id,
      productId: product.id,
      position,
      key: image.key,
    }));
  },
};

function parseStatus(value: string): ProductStatus {
  const status = ProductStatus.find((known) => known === value);
  if (!status) throw new Error(`Unknown product status in database: ${value}`);
  return status;
}
