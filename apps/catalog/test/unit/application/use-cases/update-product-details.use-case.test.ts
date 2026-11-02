import { beforeEach, describe, expect, it } from 'vitest';
import { CategoryNotFoundError } from '../../../../src/application/errors/category-not-found.error.js';
import { ProductNotFoundError } from '../../../../src/application/errors/product-not-found.error.js';
import { ProductVersionConflictError } from '../../../../src/application/errors/product-version-conflict.error.js';
import { CreateCategory } from '../../../../src/application/use-cases/create-category.use-case.js';
import { CreateProduct } from '../../../../src/application/use-cases/create-product.use-case.js';
import { UpdateProductDetails } from '../../../../src/application/use-cases/update-product-details.use-case.js';
import { InvalidWeightError } from '../../../../src/domain/errors/product.error.js';
import { testId } from '../../../support/fakes.js';
import { createTestContext, type TestContext } from '../../../support/test-context.js';

describe('UpdateProductDetails', () => {
  let ctx: TestContext;
  let updateDetails: UpdateProductDetails;
  let books: string;
  let productId: string;

  beforeEach(async () => {
    ctx = createTestContext();
    updateDetails = new UpdateProductDetails(ctx);
    ({ id: books } = await new CreateCategory(ctx).execute({ name: 'Books' }));
    ({
      product: { id: productId },
    } = await new CreateProduct(ctx).execute({
      categoryId: books,
      name: 'Dune',
      price: { amount: 4990 },
    }));
  });

  const stored = () => ctx.db.tables.products.get(productId);

  it('applies only the given fields and returns the updated view and version', async () => {
    const { id: scifi } = await new CreateCategory(ctx).execute({ name: 'Sci-fi' });

    const { product: view, version } = await updateDetails.execute({
      productId,
      expectedVersion: 1,
      description: 'A desert planet',
      categoryId: scifi,
      weightGrams: 450,
    });

    expect(version).toBe(2);
    expect(view).toMatchObject({
      name: 'Dune',
      description: 'A desert planet',
      categoryId: scifi,
      weightGrams: 450,
      price: { amount: 4990 },
    });
    expect(stored()).toMatchObject({
      description: 'A desert planet',
      categoryId: scifi,
      version: 2,
    });
  });

  it('accepts no fields at all, changing nothing', async () => {
    const before = stored();

    const { product: view, version } = await updateDetails.execute({
      productId,
      expectedVersion: 1,
    });

    expect(view).toMatchObject({ name: 'Dune', categoryId: books });
    expect(version).toBe(1);
    expect(stored()).toEqual(before);
  });

  it('rejects a stale version before changing anything', async () => {
    await updateDetails.execute({ productId, expectedVersion: 1, name: 'Dune Messiah' });

    await expect(
      updateDetails.execute({ productId, expectedVersion: 1, weightGrams: 450 }),
    ).rejects.toThrow(ProductVersionConflictError);
    expect(stored()).toMatchObject({ name: 'Dune Messiah', weightGrams: null, version: 2 });
  });

  it('rejects an unknown product', async () => {
    await expect(
      updateDetails.execute({ productId: testId(99), expectedVersion: 1, name: 'X' }),
    ).rejects.toThrow(ProductNotFoundError);
  });

  it('rejects an unknown category, changing nothing', async () => {
    await expect(
      updateDetails.execute({
        productId,
        expectedVersion: 1,
        name: 'Dune Messiah',
        categoryId: testId(99),
      }),
    ).rejects.toThrow(CategoryNotFoundError);
    expect(stored()).toMatchObject({ name: 'Dune', categoryId: books, version: 1 });
  });

  it('rejects invalid details, changing nothing', async () => {
    await expect(
      updateDetails.execute({
        productId,
        expectedVersion: 1,
        name: 'Dune Messiah',
        weightGrams: 0,
      }),
    ).rejects.toThrow(InvalidWeightError);
    expect(stored()).toMatchObject({ name: 'Dune', weightGrams: null, version: 1 });
  });
});
