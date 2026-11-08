import { beforeEach, describe, expect, it } from 'vitest';
import { ProductNotFoundError } from '#src/application/errors/product-not-found.error.js';
import { CreateCategory } from '#src/application/use-cases/create-category.use-case.js';
import { CreateProduct } from '#src/application/use-cases/create-product.use-case.js';
import { RequestImageUpload } from '#src/application/use-cases/request-image-upload.use-case.js';
import { UnsupportedImageTypeError } from '#src/domain/errors/image-upload.error.js';
import { TooManyImagesError } from '#src/domain/errors/product.error.js';
import { testId } from '#test/support/fakes.js';
import { seedImage } from '#test/support/in-memory-database.js';
import { createTestContext, type TestContext } from '#test/support/test-context.js';

const FIVE_MINUTES = 5 * 60_000;

describe('RequestImageUpload', () => {
  let ctx: TestContext;
  let requestUpload: RequestImageUpload;
  let productId: string;

  beforeEach(async () => {
    ctx = createTestContext();
    requestUpload = new RequestImageUpload(ctx);
    const { id: categoryId } = await new CreateCategory(ctx).execute({ name: 'Books' });
    ({
      product: { id: productId },
    } = await new CreateProduct(ctx).execute({ categoryId, name: 'Dune' }));
  });

  const requestMany = async (count: number) => {
    for (let i = 0; i < count; i += 1) {
      await requestUpload.execute({ productId, contentType: 'image/png' });
    }
  };

  it('signs a 5 MB, 5-minute upload permission and stores the upload as pending', async () => {
    const expiresAt = new Date(ctx.clock.now().getTime() + FIVE_MINUTES);

    const result = await requestUpload.execute({ productId, contentType: 'image/webp' });

    const imageId = testId(3);
    expect(result).toEqual({
      imageId,
      url: 'http://uploads.test',
      fields: { key: `signed-${imageId}` },
      expiresAt,
    });
    expect(ctx.signer.requests).toEqual([
      { productId, imageId, contentType: 'image/webp', maxBytes: 5 * 1024 * 1024, expiresAt },
    ]);
    expect(ctx.db.tables.imageUploads.get(imageId)).toEqual({
      id: imageId,
      productId,
      contentType: 'image/webp',
      status: 'pending',
      requestedAt: ctx.clock.now(),
      expiresAt,
    });
  });

  it('rejects an unsupported type before any I/O', async () => {
    await expect(
      requestUpload.execute({ productId: testId(99), contentType: 'image/gif' }),
    ).rejects.toThrow(UnsupportedImageTypeError);
    expect(ctx.signer.requests).toEqual([]);
  });

  it('rejects an unknown product without signing or storing anything', async () => {
    await expect(
      requestUpload.execute({ productId: testId(99), contentType: 'image/png' }),
    ).rejects.toThrow(ProductNotFoundError);
    expect(ctx.signer.requests).toEqual([]);
    expect(ctx.db.tables.imageUploads.size).toBe(0);
  });

  it('does not change the product, so admins editing it get no version conflict', async () => {
    await requestUpload.execute({ productId, contentType: 'image/png' });

    expect(ctx.db.tables.products.get(productId)?.version).toBe(1);
  });

  describe('image limit (8)', () => {
    it('allows up to 8 open uploads', async () => {
      await requestMany(8);

      expect(ctx.db.tables.imageUploads.size).toBe(8);
    });

    it('counts open uploads', async () => {
      await requestMany(8);

      await expect(requestUpload.execute({ productId, contentType: 'image/png' })).rejects.toThrow(
        TooManyImagesError,
      );
      expect(ctx.signer.requests).toHaveLength(8);
      expect(ctx.db.tables.imageUploads.size).toBe(8);
    });

    it('counts attached images', async () => {
      seedImage(ctx.db, productId);
      await requestMany(7);

      await expect(requestUpload.execute({ productId, contentType: 'image/png' })).rejects.toThrow(
        TooManyImagesError,
      );
    });

    it('frees the slot of an upload whose window closed, even before the job expires it', async () => {
      await requestMany(8);
      ctx.clock.advance(FIVE_MINUTES);

      await expect(
        requestUpload.execute({ productId, contentType: 'image/png' }),
      ).resolves.toBeDefined();
    });

    it("ignores other products' uploads", async () => {
      await requestMany(8);
      const { id: categoryId } = await new CreateCategory(ctx).execute({ name: 'Games' });
      const other = await new CreateProduct(ctx).execute({ categoryId, name: 'Chess' });

      await expect(
        requestUpload.execute({ productId: other.product.id, contentType: 'image/png' }),
      ).resolves.toBeDefined();
    });
  });

  it('stores nothing when signing fails, so no pending upload exists without a permission', async () => {
    ctx.signer.failWith(new Error('credentials unavailable'));

    await expect(requestUpload.execute({ productId, contentType: 'image/png' })).rejects.toThrow(
      'credentials unavailable',
    );
    expect(ctx.db.tables.imageUploads.size).toBe(0);
  });
});
