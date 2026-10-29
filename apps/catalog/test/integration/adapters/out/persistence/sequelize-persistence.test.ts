import { QueryTypes } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SequelizeCategoryRepository } from '../../../../../src/adapters/out/persistence/repositories/category.repository.js';
import { CategoryNameTakenError } from '../../../../../src/application/errors/category-name-taken.error.js';
import { Category } from '../../../../../src/domain/entities/category.entity.js';
import { CategoryId } from '../../../../../src/domain/value-objects/identifiers.js';
import { startPostgres, type TestPostgres } from '../../../../support/postgres.js';

const NOW = new Date('2026-10-28T12:00:00.000Z');

function newCategory(id: string, name: string): Category {
  return Category.create({ id: CategoryId(id), name, now: NOW });
}

describe('Sequelize persistence (Postgres)', () => {
  let pg: TestPostgres;
  const categories = new SequelizeCategoryRepository();

  beforeAll(async () => {
    pg = await startPostgres();
  }, 120_000);

  afterAll(async () => {
    await pg?.stop();
  });

  beforeEach(async () => {
    await pg.truncate();
  });

  const rows = () =>
    pg.sequelize.query('SELECT id, name, created_at FROM categories ORDER BY name', {
      type: QueryTypes.SELECT,
    });

  describe('categories', () => {
    it('stores the name as typed and the creation date from the domain', async () => {
      await categories.save(newCategory('0192a1f0-0000-7000-8000-000000000001', 'Books'));

      expect(await rows()).toEqual([
        { id: '0192a1f0-0000-7000-8000-000000000001', name: 'Books', created_at: NOW },
      ]);
    });

    it('saves the same category again without conflicting with itself', async () => {
      const category = newCategory('0192a1f0-0000-7000-8000-000000000001', 'Books');
      await categories.save(category);

      await expect(categories.save(category)).resolves.toBeUndefined();
    });

    it.each([
      ['Books', 'BOOKS'],
      ['Ação', 'AÇÃO'],
    ])('rejects %j when %j exists, ignoring case', async (existing, duplicate) => {
      await categories.save(newCategory('0192a1f0-0000-7000-8000-000000000001', existing));

      await expect(
        categories.save(newCategory('0192a1f0-0000-7000-8000-000000000002', duplicate)),
      ).rejects.toThrow(CategoryNameTakenError);
    });

    it('treats accented and unaccented names as different', async () => {
      await categories.save(newCategory('0192a1f0-0000-7000-8000-000000000001', 'Eletrônicos'));
      await categories.save(newCategory('0192a1f0-0000-7000-8000-000000000002', 'Eletronicos'));

      expect(await rows()).toHaveLength(2);
    });
  });
});
