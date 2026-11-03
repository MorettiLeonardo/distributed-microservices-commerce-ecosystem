import type { Sequelize } from 'sequelize';
import { ProductVersionConflictError } from '../../../../application/errors/product-version-conflict.error.js';
import type {
  ProductRepository,
  VersionedProduct,
} from '../../../../application/ports/product.repository.port.js';
import type { Product } from '../../../../domain/entities/product.entity.js';
import type { ProductId } from '../../../../domain/value-objects/identifiers.js';
import { ProductMapper } from '../mappers/product.mapper.js';
import { ProductImageModel, ProductModel } from '../models/product.model.js';

export class SequelizeProductRepository implements ProductRepository {
  constructor(private readonly sequelize: Sequelize) {}

  /**
   * One statement (LEFT JOIN), so one snapshot: two separate queries could see a save that
   * commits in between and return the new product with the old images.
   */
  async findById(id: ProductId): Promise<VersionedProduct | null> {
    const row = await ProductModel.findByPk(id, {
      include: [{ model: ProductImageModel, as: 'images' }],
    });
    return row ? { product: ProductMapper.toDomain(row), version: row.version } : null;
  }

  /**
   * One aggregate, two tables, one transaction: callers never see a product without its images.
   * Images are deleted and reinserted: at most 8 rows, ids are stable, and reordering needs no
   * diff that would collide with UNIQUE (product_id, position) halfway through.
   *
   * The version check is the UPDATE's own WHERE, not a read before it: a concurrent UPDATE of the
   * same row waits for the first one's lock, then re-evaluates the WHERE against the committed
   * row, matches nothing and loses. A SELECT first would leave a window between check and write.
   */
  async save(product: Product, expectedVersion: number | null): Promise<number> {
    return this.sequelize.transaction(async (transaction) => {
      const { id, ...fields } = ProductMapper.toPersistence(product);
      let version: number;
      if (expectedVersion === null) {
        version = 1;
        await ProductModel.create({ id, ...fields, version }, { transaction });
      } else {
        version = expectedVersion + 1;
        const [updated] = await ProductModel.update(
          { ...fields, version },
          { where: { id, version: expectedVersion }, transaction },
        );
        // Another save bumped the version, or the product was never stored.
        if (updated === 0) throw new ProductVersionConflictError();
        await ProductImageModel.destroy({ where: { productId: id }, transaction });
      }
      await ProductImageModel.bulkCreate(ProductMapper.imagesToPersistence(product), {
        transaction,
      });
      return version;
    });
  }
}
