import {
  type CreationOptional,
  DataTypes,
  type InferAttributes,
  type InferCreationAttributes,
  Model,
  type Sequelize,
} from 'sequelize';

export class SessionModel extends Model<
  InferAttributes<SessionModel>,
  InferCreationAttributes<SessionModel>
> {
  declare id: string;
  declare userId: string;
  declare currentTokenHash: string;
  declare createdAt: Date;
  declare expiresAt: Date;
  declare revokedAt: Date | null;
  declare updatedAt: CreationOptional<Date>;

  static initialize(sequelize: Sequelize): void {
    SessionModel.init(
      {
        id: { type: DataTypes.UUID, primaryKey: true },
        userId: { type: DataTypes.UUID, allowNull: false },
        currentTokenHash: { type: DataTypes.TEXT, allowNull: false },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        expiresAt: { type: DataTypes.DATE, allowNull: false },
        revokedAt: { type: DataTypes.DATE, allowNull: true },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      },
      // created_at belongs to the domain (it is part of the aggregate): Sequelize manages only updated_at.
      { sequelize, tableName: 'sessions', createdAt: false },
    );
  }
}
