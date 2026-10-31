import { beforeEach, describe, expect, it } from 'vitest';
import { testId } from '../../../support/fakes.js';
import { CategoryNotFoundError } from '../../../../src/application/errors/category-not-found.error.js';
import { CreateCategory } from '../../../../src/application/use-cases/create-category.use-case.js';
import { CreateProduct } from '../../../../src/application/use-cases/create-product.use-case.js';
import { InvalidMoneyError } from '../../../../src/domain/errors/money.error.js';
import { InvalidProductNameError } from '../../../../src/domain/errors/product.error.js';
import { createTestContext, type TestContext } from '../../../support/test-context.js';

describe('CreateProduct', () => {
  let ctx: TestContext;
  let createProduct: CreateProduct;
  let categoryId: string;

  beforeEach(async () => {
    ctx = createTestContext();
    createProduct = new CreateProduct(ctx);
    ({ id: categoryId } = await new CreateCategory(ctx).execute({ name: 'Books' }));
  });

  it('creates a draft with only the required fields and returns its view', async () => {
    const view = await createProduct.execute({ categoryId, name: '  Dune  ' });

    expect(view).toEqual({
      id: testId(2),
      categoryId,
      name: 'Dune',
      description: '',
      price: null,
      weightGrams: null,
      images: [],
      status: 'draft',
      createdAt: ctx.clock.now(),
      publishedAt: null,
    });
    expect(ctx.db.tables.products.get(view.id)).toMatchObject({ name: 'Dune', status: 'draft' });
  });

  it('creates a draft with every optional field', async () => {
    const view = await createProduct.execute({
      categoryId,
      name: 'Dune',
      description: 'A desert planet',
      price: { amount: 4990 },
      weightGrams: 450,
    });

    expect(view).toMatchObject({
      description: 'A desert planet',
      price: { amount: 4990, currency: 'BRL' },
      weightGrams: 450,
    });
  });

  it('rejects an unknown category without storing anything', async () => {
    await expect(createProduct.execute({ categoryId: 'missing', name: 'Dune' })).rejects.toThrow(
      CategoryNotFoundError,
    );
    expect(ctx.db.tables.products.size).toBe(0);
  });

  it('rejects invalid details before looking the category up', async () => {
    await expect(createProduct.execute({ categoryId: 'missing', name: '   ' })).rejects.toThrow(
      InvalidProductNameError,
    );
    await expect(
      createProduct.execute({ categoryId, name: 'Dune', price: { amount: 49.9 } }),
    ).rejects.toThrow(InvalidMoneyError);
    expect(ctx.db.tables.products.size).toBe(0);
  });
});
