import { DataTypes, type QueryInterface } from 'sequelize';

export async function up({ context: db }: { context: QueryInterface }): Promise<void> {
  await db.sequelize.transaction(async (transaction) => {
    await db.createTable(
      'categories',
      {
        id: { type: DataTypes.UUID, primaryKey: true },
        name: { type: DataTypes.TEXT, allowNull: false },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false },
      },
      { transaction },
    );
    // Names are unique ignoring case but stored as typed, so the index is on an expression.
    // The repository recognizes violations by this index name.
    await db.sequelize.query(
      'CREATE UNIQUE INDEX categories_name_unique ON categories (lower(name))',
      { transaction },
    );
  });
}

export async function down({ context: db }: { context: QueryInterface }): Promise<void> {
  await db.dropTable('categories');
}
