import { DataTypes, type QueryInterface } from 'sequelize';

export async function up({ context: db }: { context: QueryInterface }): Promise<void> {
  await db.sequelize.transaction(async (transaction) => {
    await db.createTable(
      'products',
      {
        id: { type: DataTypes.UUID, primaryKey: true },
        category_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'categories', key: 'id' },
          onDelete: 'RESTRICT',
        },
        name: { type: DataTypes.TEXT, allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: false },
        // Money as two columns, so the storefront can sort and filter by price.
        price_amount: { type: DataTypes.INTEGER, allowNull: true },
        price_currency: { type: DataTypes.TEXT, allowNull: true },
        weight_grams: { type: DataTypes.INTEGER, allowNull: true },
        status: { type: DataTypes.TEXT, allowNull: false },
        created_at: { type: DataTypes.DATE, allowNull: false },
        published_at: { type: DataTypes.DATE, allowNull: true },
        updated_at: { type: DataTypes.DATE, allowNull: false },
      },
      { transaction },
    );
    // A draft may have no price; a price is whole, above zero and in BRL (K3).
    await db.sequelize.query(
      `ALTER TABLE products ADD CONSTRAINT products_price_check CHECK (
        (price_amount IS NULL AND price_currency IS NULL) OR
        (price_amount > 0 AND price_currency = 'BRL'))`,
      { transaction },
    );
    await db.addConstraint('products', {
      type: 'check',
      name: 'products_status_check',
      fields: ['status'],
      where: { status: ['draft', 'published', 'unpublished'] },
      transaction,
    });
    // Postgres does not index foreign key columns; the storefront filters by category (K9).
    await db.addIndex('products', ['category_id'], {
      name: 'products_category_id_index',
      transaction,
    });

    // Part of the Product aggregate: rewritten on every save, so no created_at/updated_at.
    await db.createTable(
      'product_images',
      {
        id: { type: DataTypes.UUID, primaryKey: true },
        product_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'products', key: 'id' },
          onDelete: 'CASCADE',
        },
        position: { type: DataTypes.SMALLINT, allowNull: false },
        key: { type: DataTypes.TEXT, allowNull: false },
      },
      { transaction },
    );
    // At most 8 images (K4), positions 0..7. The UNIQUE index also serves lookups by product.
    await db.sequelize.query(
      'ALTER TABLE product_images ADD CONSTRAINT product_images_position_check CHECK (position BETWEEN 0 AND 7)',
      { transaction },
    );
    await db.addConstraint('product_images', {
      type: 'unique',
      name: 'product_images_product_position_unique',
      fields: ['product_id', 'position'],
      transaction,
    });
  });
}

export async function down({ context: db }: { context: QueryInterface }): Promise<void> {
  await db.sequelize.transaction(async (transaction) => {
    await db.dropTable('product_images', { transaction });
    await db.dropTable('products', { transaction });
  });
}
