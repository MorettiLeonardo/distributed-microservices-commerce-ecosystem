import { beforeEach, describe, expect, it } from 'vitest';
import { testId } from '../../../support/fakes.js';
import { CategoryNameTakenError } from '../../../../src/application/errors/category-name-taken.error.js';
import { CreateCategory } from '../../../../src/application/use-cases/create-category.use-case.js';
import { InvalidCategoryNameError } from '../../../../src/domain/errors/category.error.js';
import { createTestContext, type TestContext } from '../../../support/test-context.js';

describe('CreateCategory', () => {
  let ctx: TestContext;
  let createCategory: CreateCategory;

  beforeEach(() => {
    ctx = createTestContext();
    createCategory = new CreateCategory(ctx);
  });

  it('creates a category and returns its view', async () => {
    const view = await createCategory.execute({ name: '  Books  ' });

    expect(view).toEqual({ id: testId(1), name: 'Books', createdAt: ctx.clock.now() });
    expect([...ctx.db.tables.categories.values()]).toEqual([view]);
  });

  it('rejects a name already taken, ignoring case and surrounding spaces', async () => {
    await createCategory.execute({ name: 'Books' });

    await expect(createCategory.execute({ name: ' BOOKS ' })).rejects.toThrow(
      CategoryNameTakenError,
    );
    expect(ctx.db.tables.categories.size).toBe(1);
  });

  it('rejects an invalid name without storing anything', async () => {
    await expect(createCategory.execute({ name: '   ' })).rejects.toThrow(InvalidCategoryNameError);
    expect(ctx.db.tables.categories.size).toBe(0);
  });
});
