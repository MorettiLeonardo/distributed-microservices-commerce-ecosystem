import {
  type CreationOptional,
  DataTypes,
  type InferAttributes,
  type InferCreationAttributes,
  Model,
  type Sequelize,
} from 'sequelize';

export class OneTimeTokenModel extends Model<
  InferAttributes<OneTimeTokenModel>,
  InferCreationAttributes<OneTimeTokenModel>
> {
  declare id: string;
  declare userId: string;
  declare purpose: string;
  declare tokenHash: string;
  declare createdAt: Date;
  declare expiresAt: Date;
  declare consumedAt: Date | null;
  declare updatedAt: CreationOptional<Date>;

  static initialize(sequelize: Sequelize): void {
    OneTimeTokenModel.init(
      {
        id: { type: DataTypes.UUID, primaryKey: true },
        userId: { type: DataTypes.UUID, allowNull: false },
        purpose: { type: DataTypes.TEXT, allowNull: false },
        tokenHash: { type: DataTypes.TEXT, allowNull: false },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        expiresAt: { type: DataTypes.DATE, allowNull: false },
        consumedAt: { type: DataTypes.DATE, allowNull: true },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      },
      // created_at belongs to the domain (it is part of the aggregate): Sequelize manages only updated_at.
      { sequelize, tableName: 'one_time_tokens', createdAt: false },
    );
  }
}
