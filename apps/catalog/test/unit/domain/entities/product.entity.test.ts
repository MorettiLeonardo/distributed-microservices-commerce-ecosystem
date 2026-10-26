import { describe, expect, it } from 'vitest';
import { Product, type ProductProps } from '../../../../src/domain/entities/product.entity.js';
import {
  InvalidPriceError,
  InvalidProductDescriptionError,
  InvalidProductNameError,
  InvalidWeightError,
  ProductNotPublishableError,
  ProductNotPublishedError,
  TooManyImagesError,
} from '../../../../src/domain/errors/product.error.js';
import {
  CategoryId,
  ProductId,
  ProductImageId,
} from '../../../../src/domain/value-objects/identifiers.js';
import { Money } from '../../../../src/domain/value-objects/money.value-object.js';

const now = new Date('2026-10-25T12:00:00.000Z');
const later = new Date('2026-10-25T13:00:00.000Z');

function createDraft(overrides: Partial<Parameters<typeof Product.create>[0]> = {}): Product {
  return Product.create({
    id: ProductId('prod-1'),
    categoryId: CategoryId('cat-1'),
    name: 'Clean Code',
    now,
    ...overrides,
  });
}

function image(n: number) {
  return { id: ProductImageId(`img-${n}`), key: `products/prod-1/processed/img-${n}.webp` };
}

/** A draft with everything publishing requires. */
function restoreProduct(overrides: Partial<ProductProps> = {}): Product {
  return Product.restore({
    id: ProductId('prod-1'),
    categoryId: CategoryId('cat-1'),
    name: 'Clean Code',
    description: '',
    price: Money.of(8990),
    weightGrams: 600,
    images: [image(1)],
    status: 'draft',
    createdAt: now,
    publishedAt: null,
    ...overrides,
  });
}

describe('Product', () => {
  describe('create', () => {
    it('starts as a draft, possibly incomplete, and records ProductCreated', () => {
      const product = createDraft({ name: '  Clean Code  ' });

      expect(product.status).toBe('draft');
      expect(product.name).toBe('Clean Code');
      expect(product.description).toBe('');
      expect(product.price).toBeNull();
      expect(product.weightGrams).toBeNull();
      expect(product.images).toEqual([]);
      expect(product.pullEvents()).toEqual([
        {
          type: 'ProductCreated',
          productId: 'prod-1',
          categoryId: 'cat-1',
          name: 'Clean Code',
          occurredAt: now,
        },
      ]);
    });

    it('accepts price and weight up front', () => {
      const product = createDraft({ price: Money.of(8990), weightGrams: 600 });

      expect(product.price?.amount).toBe(8990);
      expect(product.weightGrams).toBe(600);
    });

    it.each(['', '   ', 'x'.repeat(121)])('rejects the name %j', (name) => {
      expect(() => createDraft({ name })).toThrow(InvalidProductNameError);
    });

    it('rejects a description longer than 5000 characters', () => {
      expect(() => createDraft({ description: 'x'.repeat(5001) })).toThrow(
        InvalidProductDescriptionError,
      );
    });

    it.each([0, -1, 1.5, 100_001])('rejects a weight of %s grams', (weightGrams) => {
      expect(() => createDraft({ weightGrams })).toThrow(InvalidWeightError);
    });

    it('rejects a zero price', () => {
      expect(() => createDraft({ price: Money.of(0) })).toThrow(InvalidPriceError);
    });
  });

  describe('restore', () => {
    it('records no events', () => {
      expect(restoreProduct().pullEvents()).toEqual([]);
    });
  });

  describe('updateDetails', () => {
    it('applies the changes and records which fields changed', () => {
      const product = restoreProduct();

      product.updateDetails({ name: 'Clean Code, 2nd ed.', weightGrams: 650 }, later);

      expect(product.name).toBe('Clean Code, 2nd ed.');
      expect(product.weightGrams).toBe(650);
      expect(product.pullEvents()).toEqual([
        {
          type: 'ProductDetailsUpdated',
          productId: 'prod-1',
          changedFields: ['name', 'weightGrams'],
          occurredAt: later,
        },
      ]);
    });

    it('records nothing when no field actually changes', () => {
      const product = restoreProduct();

      product.updateDetails({ name: 'Clean Code', categoryId: CategoryId('cat-1') }, later);

      expect(product.pullEvents()).toEqual([]);
    });

    it('validates the new values', () => {
      expect(() => restoreProduct().updateDetails({ name: '' }, later)).toThrow(
        InvalidProductNameError,
      );
      expect(() => restoreProduct().updateDetails({ weightGrams: 0 }, later)).toThrow(
        InvalidWeightError,
      );
    });
  });

  describe('changePrice', () => {
    it('records the previous and the current price', () => {
      const product = restoreProduct();

      product.changePrice(Money.of(7990), later);

      expect(product.price?.amount).toBe(7990);
      expect(product.pullEvents()).toEqual([
        {
          type: 'ProductPriceChanged',
          productId: 'prod-1',
          previous: { amount: 8990, currency: 'BRL' },
          current: { amount: 7990, currency: 'BRL' },
          occurredAt: later,
        },
      ]);
    });

    it('records a null previous price for the first price of a draft', () => {
      const product = createDraft();
      product.pullEvents();

      product.changePrice(Money.of(100), later);

      expect(product.pullEvents()).toMatchObject([{ previous: null }]);
    });

    it('records nothing for the same price', () => {
      const product = restoreProduct();
      product.changePrice(Money.of(8990), later);
      expect(product.pullEvents()).toEqual([]);
    });

    it('rejects a zero price', () => {
      expect(() => restoreProduct().changePrice(Money.of(0), later)).toThrow(InvalidPriceError);
    });
  });

  describe('attachImage', () => {
    it('appends the image and records ProductImageAttached', () => {
      const product = restoreProduct({ images: [] });

      product.attachImage(image(1), later);

      expect(product.images).toEqual([image(1)]);
      expect(product.pullEvents()).toEqual([
        {
          type: 'ProductImageAttached',
          productId: 'prod-1',
          imageId: 'img-1',
          occurredAt: later,
        },
      ]);
    });

    it('is idempotent for an image that is already attached', () => {
      const product = restoreProduct();

      product.attachImage(image(1), later);

      expect(product.images).toHaveLength(1);
      expect(product.pullEvents()).toEqual([]);
    });

    it('rejects a ninth image', () => {
      const product = restoreProduct({ images: [1, 2, 3, 4, 5, 6, 7, 8].map(image) });

      expect(() => product.attachImage(image(9), later)).toThrow(TooManyImagesError);
      expect(product.images).toHaveLength(8);
    });

    it('does not let callers mutate the images from outside', () => {
      const product = restoreProduct();
      (product.images as unknown[]).push(image(2));
      expect(product.images).toHaveLength(1);
    });
  });

  describe('publish', () => {
    it('publishes a complete draft and records ProductPublished', () => {
      const product = restoreProduct();

      product.publish(later);

      expect(product.status).toBe('published');
      expect(product.publishedAt).toEqual(later);
      expect(product.pullEvents()).toEqual([
        { type: 'ProductPublished', productId: 'prod-1', occurredAt: later },
      ]);
    });

    it('lists everything that is missing at once', () => {
      const product = createDraft();

      const error = (() => {
        try {
          product.publish(later);
        } catch (caught) {
          return caught;
        }
        throw new Error('expected publish to fail');
      })();

      expect(error).toBeInstanceOf(ProductNotPublishableError);
      expect((error as ProductNotPublishableError).missing).toEqual(['price', 'weight', 'image']);
      expect(product.status).toBe('draft');
    });

    it('is idempotent for a published product', () => {
      const product = restoreProduct({ status: 'published', publishedAt: now });

      product.publish(later);

      expect(product.publishedAt).toEqual(now);
      expect(product.pullEvents()).toEqual([]);
    });

    it('republishes an unpublished product', () => {
      const product = restoreProduct({ status: 'unpublished', publishedAt: now });

      product.publish(later);

      expect(product.status).toBe('published');
      expect(product.publishedAt).toEqual(later);
    });
  });

  describe('unpublish', () => {
    it('takes a published product off the storefront and records ProductUnpublished', () => {
      const product = restoreProduct({ status: 'published', publishedAt: now });

      product.unpublish(later);

      expect(product.status).toBe('unpublished');
      expect(product.pullEvents()).toEqual([
        { type: 'ProductUnpublished', productId: 'prod-1', occurredAt: later },
      ]);
    });

    it('is idempotent for an unpublished product', () => {
      const product = restoreProduct({ status: 'unpublished', publishedAt: now });
      product.unpublish(later);
      expect(product.pullEvents()).toEqual([]);
    });

    it('rejects a draft, which was never published', () => {
      expect(() => restoreProduct().unpublish(later)).toThrow(ProductNotPublishedError);
    });
  });
});
