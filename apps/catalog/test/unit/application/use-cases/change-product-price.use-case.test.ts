import { beforeEach, describe, expect, it } from 'vitest';
import { ProductNotFoundError } from '#src/application/errors/product-not-found.error.js';
import { ProductVersionConflictError } from '#src/application/errors/product-version-conflict.error.js';
import { ChangeProductPrice } from '#src/application/use-cases/change-product-price.use-case.js';
import { CreateCategory } from '#src/application/use-cases/create-category.use-case.js';
import { CreateProduct } from '#src/application/use-cases/create-product.use-case.js';
import { InvalidMoneyError } from '#src/domain/errors/money.error.js';
import { InvalidPriceError } from '#src/domain/errors/product.error.js';
import { Money } from '#src/domain/value-objects/money.value-object.js';
import { testId } from '#test/support/fakes.js';
import { createTestContext, type TestContext } from '#test/support/test-context.js';

describe('ChangeProductPrice', () => {
  let ctx: TestContext;
  let changePrice: ChangeProductPrice;
  let productId: string;

  beforeEach(async () => {
    ctx = createTestContext();
    changePrice = new ChangeProductPrice(ctx);
    const { id: categoryId } = await new CreateCategory(ctx).execute({ name: 'Books' });
    ({
      product: { id: productId },
    } = await new CreateProduct(ctx).execute({ categoryId, name: 'Dune' }));
  });

  const stored = () => ctx.db.tables.products.get(productId);

  it('sets the price and returns the view and the new version', async () => {
    const { product, version } = await changePrice.execute({
      productId,
      expectedVersion: 1,
      price: { amount: 4990 },
    });

    expect(version).toBe(2);
    expect(product.price).toEqual({ amount: 4990, currency: 'BRL' });
    expect(stored()).toMatchObject({ price: Money.of(4990), version: 2 });
  });

  it('changes nothing, not even the version, when the price is the same', async () => {
    await changePrice.execute({ productId, expectedVersion: 1, price: { amount: 4990 } });

    const { version } = await changePrice.execute({
      productId,
      expectedVersion: 2,
      price: { amount: 4990, currency: 'BRL' },
    });

    expect(version).toBe(2);
    expect(stored()).toMatchObject({ version: 2 });
  });

  it.each([
    ['a zero price', { amount: 0 }, InvalidPriceError],
    ['a fractional price', { amount: 49.9 }, InvalidMoneyError],
    ['an unknown currency', { amount: 4990, currency: 'USD' }, InvalidMoneyError],
  ])('rejects %s, changing nothing', async (_case, price, error) => {
    await expect(changePrice.execute({ productId, expectedVersion: 1, price })).rejects.toThrow(
      error,
    );
    expect(stored()).toMatchObject({ price: null, version: 1 });
  });

  it('rejects a stale version', async () => {
    await expect(
      changePrice.execute({ productId, expectedVersion: 2, price: { amount: 4990 } }),
    ).rejects.toThrow(ProductVersionConflictError);
  });

  it('rejects an unknown product', async () => {
    await expect(
      changePrice.execute({ productId: testId(99), expectedVersion: 1, price: { amount: 4990 } }),
    ).rejects.toThrow(ProductNotFoundError);
  });
});
