import { DataTypes, type QueryInterface } from 'sequelize';

const timestamps = {
  created_at: { type: DataTypes.DATE, allowNull: false },
  updated_at: { type: DataTypes.DATE, allowNull: false },
};

export async function up({ context: db }: { context: QueryInterface }): Promise<void> {
  await db.sequelize.transaction(async (transaction) => {
    await db.createTable(
      'users',
      {
        id: { type: DataTypes.UUID, primaryKey: true },
        email: { type: DataTypes.TEXT, allowNull: false },
        password_hash: { type: DataTypes.TEXT, allowNull: false },
        status: { type: DataTypes.TEXT, allowNull: false },
        email_verified_at: { type: DataTypes.DATE, allowNull: true },
        ...timestamps,
      },
      { transaction },
    );
    // The domain normalizes emails to lowercase, so a plain UNIQUE index is enough.
    await db.addIndex('users', ['email'], {
      name: 'users_email_unique',
      unique: true,
      transaction,
    });
    await db.addConstraint('users', {
      type: 'check',
      name: 'users_status_check',
      fields: ['status'],
      where: { status: ['pending_verification', 'active', 'disabled'] },
      transaction,
    });

    await db.createTable(
      'sessions',
      {
        id: { type: DataTypes.UUID, primaryKey: true },
        user_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
        },
        current_token_hash: { type: DataTypes.TEXT, allowNull: false },
        expires_at: { type: DataTypes.DATE, allowNull: false },
        revoked_at: { type: DataTypes.DATE, allowNull: true },
        ...timestamps,
      },
      { transaction },
    );
    // Serves findActiveByUserId; revoked sessions (the majority over time) stay out of the index.
    await db.addIndex('sessions', ['user_id'], {
      name: 'sessions_active_user_id_idx',
      where: { revoked_at: null },
      transaction,
    });

    await db.createTable(
      'one_time_tokens',
      {
        id: { type: DataTypes.UUID, primaryKey: true },
        user_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
        },
        purpose: { type: DataTypes.TEXT, allowNull: false },
        token_hash: { type: DataTypes.TEXT, allowNull: false },
        expires_at: { type: DataTypes.DATE, allowNull: false },
        consumed_at: { type: DataTypes.DATE, allowNull: true },
        ...timestamps,
      },
      { transaction },
    );
    await db.addIndex('one_time_tokens', ['token_hash'], {
      name: 'one_time_tokens_token_hash_unique',
      unique: true,
      transaction,
    });
    await db.addConstraint('one_time_tokens', {
      type: 'check',
      name: 'one_time_tokens_purpose_check',
      fields: ['purpose'],
      where: { purpose: ['email_verification', 'password_reset'] },
      transaction,
    });
  });
}

export async function down({ context: db }: { context: QueryInterface }): Promise<void> {
  await db.sequelize.transaction(async (transaction) => {
    await db.dropTable('one_time_tokens', { transaction });
    await db.dropTable('sessions', { transaction });
    await db.dropTable('users', { transaction });
  });
}
