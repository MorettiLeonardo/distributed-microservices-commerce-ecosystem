import { DataTypes, type QueryInterface } from 'sequelize';

/** Optimistic locking: every update must name the version it read and bumps it by one. */
export async function up({ context: db }: { context: QueryInterface }): Promise<void> {
  // DEFAULT 1 gives existing rows a version without a backfill.
  await db.addColumn('products', 'version', {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  });
}

export async function down({ context: db }: { context: QueryInterface }): Promise<void> {
  await db.removeColumn('products', 'version');
}
