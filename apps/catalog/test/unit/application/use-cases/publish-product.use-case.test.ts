import { beforeEach, describe, expect, it } from 'vitest';
import { ProductNotFoundError } from '#src/application/errors/product-not-found.error.js';
import { ProductVersionConflictError } from '#src/application/errors/product-version-conflict.error.js';
import { CreateCategory } from '#src/application/use-cases/create-category.use-case.js';
import { CreateProduct } from '#src/application/use-cases/create-product.use-case.js';
import { PublishProduct } from '#src/application/use-cases/publish-product.use-case.js';
import { UnpublishProduct } from '#src/application/use-cases/unpublish-product.use-case.js';
import {
  ProductNotPublishableError,
  ProductNotPublishedError,
} from '#src/domain/errors/product.error.js';
import { testId } from '#test/support/fakes.js';
import { seedImage } from '#test/support/in-memory-database.js';
import { createTestContext, type TestContext } from '#test/support/test-context.js';

describe('PublishProduct and UnpublishProduct', () => {
  let ctx: TestContext;
  let publish: PublishProduct;
  let unpublish: UnpublishProduct;
  let categoryId: string;

  beforeEach(async () => {
    ctx = createTestContext();
    publish = new PublishProduct(ctx);
    unpublish = new UnpublishProduct(ctx);
    ({ id: categoryId } = await new CreateCategory(ctx).execute({ name: 'Books' }));
  });

  /** A draft with price, weight and an image: everything publishing requires. */
  const completeDraft = async () => {
    const { product } = await new CreateProduct(ctx).execute({
      categoryId,
      name: 'Dune',
      price: { amount: 4990 },
      weightGrams: 450,
    });
    // No use case attaches images until increment 6.
    seedImage(ctx.db, product.id);
    return product.id;
  };

  const stored = (id: string) => ctx.db.tables.products.get(id);

  describe('PublishProduct', () => {
    it('publishes a complete draft, stamping publishedAt', async () => {
      const productId = await completeDraft();

      const { product, version } = await publish.execute({ productId, expectedVersion: 1 });

      expect(version).toBe(2);
      expect(product).toMatchObject({ status: 'published', publishedAt: ctx.clock.now() });
      expect(stored(productId)).toMatchObject({ status: 'published', version: 2 });
    });

    it('lists everything a draft still lacks, changing nothing', async () => {
      const { product } = await new CreateProduct(ctx).execute({ categoryId, name: 'Dune' });

      const error = await publish
        .execute({ productId: product.id, expectedVersion: 1 })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ProductNotPublishableError);
      expect((error as ProductNotPublishableError).missing).toEqual(['price', 'weight', 'image']);
      expect(stored(product.id)).toMatchObject({ status: 'draft', version: 1 });
    });

    it('is a no-op on a published product, keeping the version', async () => {
      const productId = await completeDraft();
      await publish.execute({ productId, expectedVersion: 1 });

      const { version } = await publish.execute({ productId, expectedVersion: 2 });

      expect(version).toBe(2);
    });

    it('republishes an unpublished product', async () => {
      const productId = await completeDraft();
      await publish.execute({ productId, expectedVersion: 1 });
      await unpublish.execute({ productId, expectedVersion: 2 });

      const { product, version } = await publish.execute({ productId, expectedVersion: 3 });

      expect(product.status).toBe('published');
      expect(version).toBe(4);
    });

    it('rejects a stale version', async () => {
      const productId = await completeDraft();

      await expect(publish.execute({ productId, expectedVersion: 2 })).rejects.toThrow(
        ProductVersionConflictError,
      );
      expect(stored(productId)).toMatchObject({ status: 'draft' });
    });

    it('rejects an unknown product', async () => {
      await expect(publish.execute({ productId: testId(99), expectedVersion: 1 })).rejects.toThrow(
        ProductNotFoundError,
      );
    });
  });

  describe('UnpublishProduct', () => {
    it('takes a published product off the storefront', async () => {
      const productId = await completeDraft();
      await publish.execute({ productId, expectedVersion: 1 });

      const { product, version } = await unpublish.execute({ productId, expectedVersion: 2 });

      expect(version).toBe(3);
      expect(product.status).toBe('unpublished');
      expect(stored(productId)).toMatchObject({ status: 'unpublished', version: 3 });
    });

    it('rejects a draft, which was never on the storefront', async () => {
      const productId = await completeDraft();

      await expect(unpublish.execute({ productId, expectedVersion: 1 })).rejects.toThrow(
        ProductNotPublishedError,
      );
      expect(stored(productId)).toMatchObject({ status: 'draft', version: 1 });
    });

    it('is a no-op on an unpublished product, keeping the version', async () => {
      const productId = await completeDraft();
      await publish.execute({ productId, expectedVersion: 1 });
      await unpublish.execute({ productId, expectedVersion: 2 });

      const { version } = await unpublish.execute({ productId, expectedVersion: 3 });

      expect(version).toBe(3);
    });

    it('rejects a stale version', async () => {
      const productId = await completeDraft();
      await publish.execute({ productId, expectedVersion: 1 });

      await expect(unpublish.execute({ productId, expectedVersion: 1 })).rejects.toThrow(
        ProductVersionConflictError,
      );
      expect(stored(productId)).toMatchObject({ status: 'published' });
    });
  });
});
