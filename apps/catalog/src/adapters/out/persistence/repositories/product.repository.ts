import type { Sequelize } from 'sequelize';
import type { ProductRepository } from '../../../../application/ports/product.repository.port.js';
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
  async findById(id: ProductId): Promise<Product | null> {
    const row = await ProductModel.findByPk(id, {
      include: [{ model: ProductImageModel, as: 'images' }],
    });
    return row ? ProductMapper.toDomain(row) : null;
  }

  /**
   * One aggregate, two tables, one transaction: callers never see a product without its images.
   * Images are deleted and reinserted: at most 8 rows, ids are stable, and reordering needs no
   * diff that would collide with UNIQUE (product_id, position) halfway through.
   */
  async save(product: Product): Promise<void> {
    await this.sequelize.transaction(async (transaction) => {
      await ProductModel.upsert(ProductMapper.toPersistence(product), { transaction });
      await ProductImageModel.destroy({ where: { productId: product.id }, transaction });
      await ProductImageModel.bulkCreate(ProductMapper.imagesToPersistence(product), {
        transaction,
      });
    });
  }
}
