import { ForeignKeyConstraintError, QueryTypes } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SequelizeCategoryRepository } from '../../../../../src/adapters/out/persistence/repositories/category.repository.js';
import { SequelizeProductRepository } from '../../../../../src/adapters/out/persistence/repositories/product.repository.js';
import { CategoryNameTakenError } from '../../../../../src/application/errors/category-name-taken.error.js';
import { ProductVersionConflictError } from '../../../../../src/application/errors/product-version-conflict.error.js';
import type { VersionedProduct } from '../../../../../src/application/ports/product.repository.port.js';
import { Category } from '../../../../../src/domain/entities/category.entity.js';
import { Product, type ProductProps } from '../../../../../src/domain/entities/product.entity.js';
import {
  CategoryId,
  ProductId,
  ProductImageId,
} from '../../../../../src/domain/value-objects/identifiers.js';
import { Money } from '../../../../../src/domain/value-objects/money.value-object.js';
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

  const productRows = () =>
    pg.sequelize.query('SELECT * FROM products', { type: QueryTypes.SELECT });

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

    it('tells whether a category exists', async () => {
      await categories.save(newCategory('0192a1f0-0000-7000-8000-000000000001', 'Books'));

      expect(await categories.exists(CategoryId('0192a1f0-0000-7000-8000-000000000001'))).toBe(
        true,
      );
      expect(await categories.exists(CategoryId('0192a1f0-0000-7000-8000-000000000002'))).toBe(
        false,
      );
    });
  });

  describe('products', () => {
    const CATEGORY_ID = '0192a1f0-0000-7000-8000-000000000001';
    const PRODUCT_ID = '0192a1f0-0000-7000-8000-0000000000a1';
    let products: SequelizeProductRepository;

    beforeAll(() => {
      products = new SequelizeProductRepository(pg.sequelize);
    });

    beforeEach(async () => {
      await categories.save(newCategory(CATEGORY_ID, 'Books'));
    });

    const imageRows = () =>
      pg.sequelize.query(
        'SELECT id, position, key FROM product_images WHERE product_id = :id ORDER BY position',
        { type: QueryTypes.SELECT, replacements: { id: PRODUCT_ID } },
      );

    const image = (n: number) => ({
      id: ProductImageId(`0192a1f0-0000-7000-8000-00000000000${n}`),
      key: `products/${PRODUCT_ID}/${n}.webp`,
    });

    const draft = (categoryId = CATEGORY_ID) =>
      Product.create({
        id: ProductId(PRODUCT_ID),
        categoryId: CategoryId(categoryId),
        name: 'Dune',
        now: NOW,
      });

    it('stores a new product at version 1, with the missing fields as NULL', async () => {
      expect(await products.save(draft(), null)).toBe(1);

      expect(await productRows()).toEqual([
        {
          id: PRODUCT_ID,
          category_id: CATEGORY_ID,
          name: 'Dune',
          description: '',
          price_amount: null,
          price_currency: null,
          weight_grams: null,
          status: 'draft',
          version: 1,
          created_at: NOW,
          published_at: null,
          updated_at: expect.any(Date),
        },
      ]);
      expect(await imageRows()).toEqual([]);
    });

    it('stores the price as amount and currency columns', async () => {
      const product = draft();
      product.changePrice(Money.of(4990), NOW);
      await products.save(product, null);

      expect(await productRows()).toMatchObject([{ price_amount: 4990, price_currency: 'BRL' }]);
    });

    it('stores images in display order and replaces them on every save', async () => {
      const product = draft();
      for (const n of [1, 2, 3]) product.attachImage(image(n), NOW);
      await products.save(product, null);

      expect(await imageRows()).toEqual([
        { ...image(1), position: 0 },
        { ...image(2), position: 1 },
        { ...image(3), position: 2 },
      ]);

      // Reordering and dropping an image used to require a diff; delete-and-reinsert avoids it.
      const reordered = Product.restore({
        ...productProps(product),
        images: [image(3), image(1)],
      });
      await products.save(reordered, 1);

      expect(await imageRows()).toEqual([
        { ...image(3), position: 0 },
        { ...image(1), position: 1 },
      ]);
    });

    it('rolls the whole save back when an image row is rejected', async () => {
      const product = draft();
      product.attachImage(image(1), NOW);
      await products.save(product, null);
      // restore() skips the 8-image rule, so the position CHECK is what rejects the 9th row.
      const tooMany = Product.restore({
        ...productProps(product),
        name: 'Dune Messiah',
        images: Array.from({ length: 9 }, (_, i) => ({
          id: ProductImageId(`0192a1f0-0000-7000-8000-0000000001${String(i).padStart(2, '0')}`),
          key: `products/${PRODUCT_ID}/${i}.webp`,
        })),
      });

      await expect(products.save(tooMany, 1)).rejects.toThrow(/product_images_position_check/);
      expect(await productRows()).toMatchObject([{ name: 'Dune', version: 1 }]);
      expect(await imageRows()).toEqual([{ ...image(1), position: 0 }]);
    });

    it('rejects a product whose category does not exist, untranslated', async () => {
      const orphan = draft('0192a1f0-0000-7000-8000-000000000099');

      await expect(products.save(orphan, null)).rejects.toThrow(ForeignKeyConstraintError);
      expect(await productRows()).toEqual([]);
    });

    describe('optimistic locking', () => {
      it('bumps the version on every update', async () => {
        const product = draft();
        await products.save(product, null);

        expect(await products.save(product, 1)).toBe(2);
        expect(await products.save(product, 2)).toBe(3);
        expect(await productRows()).toMatchObject([{ version: 3 }]);
      });

      it('rejects a stale version, leaving the stored product untouched', async () => {
        await products.save(draft(), null);
        const first = draft();
        first.updateDetails({ name: 'Dune Messiah' }, NOW);
        await products.save(first, 1);

        const stale = draft();
        stale.attachImage(image(1), NOW);
        await expect(products.save(stale, 1)).rejects.toThrow(ProductVersionConflictError);

        expect(await productRows()).toMatchObject([{ name: 'Dune Messiah', version: 2 }]);
        expect(await imageRows()).toEqual([]);
      });

      it('lets only one of two concurrent updates based on the same version win', async () => {
        await products.save(draft(), null);
        const loaded = await Promise.all([
          products.findById(ProductId(PRODUCT_ID)),
          products.findById(ProductId(PRODUCT_ID)),
        ]);
        const [a, b] = loaded.map((found) => {
          if (!found) throw new Error('product not stored');
          return found;
        }) as [VersionedProduct, VersionedProduct];
        a.product.updateDetails({ name: 'Dune Messiah' }, NOW);
        b.product.changePrice(Money.of(5990), NOW);

        // The second UPDATE waits for the first one's row lock, then re-checks its WHERE.
        const results = await Promise.allSettled(
          [a, b].map((found) => products.save(found.product, found.version)),
        );

        const fulfilled = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
        const rejected = results.flatMap((r) => (r.status === 'rejected' ? [r.reason] : []));
        expect(fulfilled).toEqual([2]);
        expect(rejected).toEqual([expect.any(ProductVersionConflictError)]);
        expect(await productRows()).toMatchObject([{ version: 2 }]);
      });

      it('rejects updating a product that was never stored', async () => {
        await expect(products.save(draft(), 1)).rejects.toThrow(ProductVersionConflictError);
        expect(await productRows()).toEqual([]);
      });
    });

    it('reads back every field and the version, with the images in display order', async () => {
      const product = draft();
      product.updateDetails({ description: 'A desert planet', weightGrams: 450 }, NOW);
      product.changePrice(Money.of(4990), NOW);
      for (const n of [3, 1, 2]) product.attachImage(image(n), NOW);
      product.publish(NOW);
      await products.save(product, null);
      await products.save(product, 1);

      const found = await products.findById(ProductId(PRODUCT_ID));

      expect(found?.version).toBe(2);
      expect(found && productProps(found.product)).toEqual(productProps(product));
      expect(found?.product.pullEvents()).toEqual([]);
    });

    it('orders images by position, not by the order rows happen to be stored in', async () => {
      await products.save(draft(), null);
      // Inserted last position first: without ORDER BY, Postgres would tend to return them so.
      for (const [n, position] of [
        [2, 1],
        [1, 0],
      ] as const) {
        await pg.sequelize.query(
          'INSERT INTO product_images (id, product_id, position, key) VALUES (:id, :productId, :position, :key)',
          { replacements: { ...image(n), productId: PRODUCT_ID, position } },
        );
      }

      const found = await products.findById(ProductId(PRODUCT_ID));

      expect(found?.product.images).toEqual([image(1), image(2)]);
    });

    it('reads a draft without price, weight or images', async () => {
      await products.save(draft(), null);

      const found = await products.findById(ProductId(PRODUCT_ID));

      expect(found && productProps(found.product)).toEqual(productProps(draft()));
    });

    it('returns null for an unknown product', async () => {
      expect(await products.findById(ProductId('0192a1f0-0000-7000-8000-0000000000ff'))).toBeNull();
    });

    it('rejects a zero price written behind the domain', async () => {
      await products.save(draft(), null);

      await expect(
        pg.sequelize.query('UPDATE products SET price_amount = 0, price_currency = :currency', {
          replacements: { currency: 'BRL' },
        }),
      ).rejects.toThrow(/products_price_check/);
    });
  });
});

/** Every field of a product, to restore it in states the domain cannot reach. */
function productProps(product: Product): ProductProps {
  return {
    id: product.id,
    categoryId: product.categoryId,
    name: product.name,
    description: product.description,
    price: product.price,
    weightGrams: product.weightGrams,
    images: product.images,
    status: product.status,
    createdAt: product.createdAt,
    publishedAt: product.publishedAt,
  };
}
