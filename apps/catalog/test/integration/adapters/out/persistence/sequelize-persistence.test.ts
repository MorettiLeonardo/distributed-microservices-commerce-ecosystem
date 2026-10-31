import { ForeignKeyConstraintError, QueryTypes } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SequelizeCategoryRepository } from '../../../../../src/adapters/out/persistence/repositories/category.repository.js';
import { SequelizeProductRepository } from '../../../../../src/adapters/out/persistence/repositories/product.repository.js';
import { CategoryNameTakenError } from '../../../../../src/application/errors/category-name-taken.error.js';
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

    it('stores a draft with the missing fields as NULL', async () => {
      await products.save(draft());

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
      await products.save(product);

      expect(await productRows()).toMatchObject([{ price_amount: 4990, price_currency: 'BRL' }]);
    });

    it('stores images in display order and replaces them on every save', async () => {
      const product = draft();
      for (const n of [1, 2, 3]) product.attachImage(image(n), NOW);
      await products.save(product);

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
      await products.save(reordered);

      expect(await imageRows()).toEqual([
        { ...image(3), position: 0 },
        { ...image(1), position: 1 },
      ]);
    });

    it('rolls the whole save back when an image row is rejected', async () => {
      // restore() skips the 8-image rule, so the position CHECK is what rejects the 9th row.
      const tooMany = Product.restore({
        ...productProps(draft()),
        images: Array.from({ length: 9 }, (_, i) => ({
          id: ProductImageId(`0192a1f0-0000-7000-8000-0000000001${String(i).padStart(2, '0')}`),
          key: `products/${PRODUCT_ID}/${i}.webp`,
        })),
      });

      await expect(products.save(tooMany)).rejects.toThrow(/product_images_position_check/);
      expect(await productRows()).toEqual([]);
      expect(await imageRows()).toEqual([]);
    });

    it('rejects a product whose category does not exist, untranslated', async () => {
      const orphan = draft('0192a1f0-0000-7000-8000-000000000099');

      await expect(products.save(orphan)).rejects.toThrow(ForeignKeyConstraintError);
      expect(await productRows()).toEqual([]);
    });

    it('reads back every field, with the images in display order', async () => {
      const product = draft();
      product.updateDetails({ description: 'A desert planet', weightGrams: 450 }, NOW);
      product.changePrice(Money.of(4990), NOW);
      for (const n of [3, 1, 2]) product.attachImage(image(n), NOW);
      product.publish(NOW);
      await products.save(product);

      const found = await products.findById(ProductId(PRODUCT_ID));

      expect(found && productProps(found)).toEqual(productProps(product));
      expect(found?.pullEvents()).toEqual([]);
    });

    it('orders images by position, not by the order rows happen to be stored in', async () => {
      await products.save(draft());
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

      expect(found?.images).toEqual([image(1), image(2)]);
    });

    it('reads a draft without price, weight or images', async () => {
      await products.save(draft());

      const found = await products.findById(ProductId(PRODUCT_ID));

      expect(found && productProps(found)).toEqual(productProps(draft()));
    });

    it('returns null for an unknown product', async () => {
      expect(await products.findById(ProductId('0192a1f0-0000-7000-8000-0000000000ff'))).toBeNull();
    });

    it('rejects a zero price written behind the domain', async () => {
      await products.save(draft());

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
