import { DataTypes, type QueryInterface } from 'sequelize';

export async function up({ context: db }: { context: QueryInterface }): Promise<void> {
  await db.sequelize.transaction(async (transaction) => {
    // The default turns every existing user into a customer: no backfill needed.
    await db.addColumn(
      'users',
      'role',
      { type: DataTypes.TEXT, allowNull: false, defaultValue: 'customer' },
      { transaction },
    );
    await db.addConstraint('users', {
      type: 'check',
      name: 'users_role_check',
      fields: ['role'],
      where: { role: ['customer', 'admin'] },
      transaction,
    });
  });
}

export async function down({ context: db }: { context: QueryInterface }): Promise<void> {
  await db.sequelize.transaction(async (transaction) => {
    await db.removeConstraint('users', 'users_role_check', { transaction });
    await db.removeColumn('users', 'role', { transaction });
  });
}
