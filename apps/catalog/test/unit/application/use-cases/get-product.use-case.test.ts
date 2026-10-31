import { beforeEach, describe, expect, it } from 'vitest';
import { ProductNotFoundError } from '../../../../src/application/errors/product-not-found.error.js';
import { CreateCategory } from '../../../../src/application/use-cases/create-category.use-case.js';
import { CreateProduct } from '../../../../src/application/use-cases/create-product.use-case.js';
import { GetProduct } from '../../../../src/application/use-cases/get-product.use-case.js';
import { testId } from '../../../support/fakes.js';
import { createTestContext, type TestContext } from '../../../support/test-context.js';

describe('GetProduct', () => {
  let ctx: TestContext;
  let getProduct: GetProduct;

  beforeEach(() => {
    ctx = createTestContext();
    getProduct = new GetProduct(ctx);
  });

  it('returns the view of an existing product', async () => {
    const { id: categoryId } = await new CreateCategory(ctx).execute({ name: 'Books' });
    const created = await new CreateProduct(ctx).execute({
      categoryId,
      name: 'Dune',
      price: { amount: 4990 },
    });

    expect(await getProduct.execute({ productId: created.id })).toEqual(created);
  });

  it('rejects an unknown product', async () => {
    await expect(getProduct.execute({ productId: testId(99) })).rejects.toThrow(
      ProductNotFoundError,
    );
  });
});
