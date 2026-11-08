import { DataTypes, type QueryInterface } from 'sequelize';

export async function up({ context: db }: { context: QueryInterface }): Promise<void> {
  await db.sequelize.transaction(async (transaction) => {
    // Its own aggregate, not part of Product: requesting an upload does not bump the product's version.
    await db.createTable(
      'image_uploads',
      {
        id: { type: DataTypes.UUID, primaryKey: true },
        product_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'products', key: 'id' },
          onDelete: 'RESTRICT',
        },
        content_type: { type: DataTypes.TEXT, allowNull: false },
        status: { type: DataTypes.TEXT, allowNull: false },
        requested_at: { type: DataTypes.DATE, allowNull: false },
        expires_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false },
      },
      { transaction },
    );
    await db.addConstraint('image_uploads', {
      type: 'check',
      name: 'image_uploads_status_check',
      fields: ['status'],
      where: { status: ['pending', 'attached', 'rejected', 'expired'] },
      transaction,
    });
    await db.addConstraint('image_uploads', {
      type: 'check',
      name: 'image_uploads_content_type_check',
      fields: ['content_type'],
      where: { content_type: ['image/jpeg', 'image/png', 'image/webp'] },
      transaction,
    });
    // Partial: only pending uploads are ever queried, and they are few. Settled ones pile up
    // without growing the index. Serves the open-uploads count (product_id, then expires_at).
    await db.addIndex('image_uploads', ['product_id', 'expires_at'], {
      name: 'image_uploads_pending_index',
      where: { status: 'pending' },
      transaction,
    });
  });
}

export async function down({ context: db }: { context: QueryInterface }): Promise<void> {
  await db.dropTable('image_uploads');
}
