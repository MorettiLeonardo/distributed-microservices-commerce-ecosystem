import {
  type CreationOptional,
  DataTypes,
  type InferAttributes,
  type InferCreationAttributes,
  Model,
  type Sequelize,
} from 'sequelize';

/** Persistence shape of the User aggregate. Never leaves `adapters/out/persistence`. */
export class UserModel extends Model<
  InferAttributes<UserModel>,
  InferCreationAttributes<UserModel>
> {
  declare id: string;
  declare email: string;
  declare passwordHash: string;
  declare status: string;
  declare emailVerifiedAt: Date | null;
  declare createdAt: Date;
  declare updatedAt: CreationOptional<Date>;

  static initialize(sequelize: Sequelize): void {
    UserModel.init(
      {
        id: { type: DataTypes.UUID, primaryKey: true },
        email: { type: DataTypes.TEXT, allowNull: false },
        passwordHash: { type: DataTypes.TEXT, allowNull: false },
        status: { type: DataTypes.TEXT, allowNull: false },
        emailVerifiedAt: { type: DataTypes.DATE, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      },
      // created_at belongs to the domain (it is part of the aggregate): Sequelize manages only updated_at.
      { sequelize, tableName: 'users', createdAt: false },
    );
  }
}
