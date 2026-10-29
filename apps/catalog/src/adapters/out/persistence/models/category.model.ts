import {
  type CreationOptional,
  DataTypes,
  type InferAttributes,
  type InferCreationAttributes,
  Model,
  type Sequelize,
} from 'sequelize';

/** Persistence shape of the Category aggregate. Never leaves `adapters/out/persistence`. */
export class CategoryModel extends Model<
  InferAttributes<CategoryModel>,
  InferCreationAttributes<CategoryModel>
> {
  declare id: string;
  declare name: string;
  declare createdAt: Date;
  declare updatedAt: CreationOptional<Date>;

  static initialize(sequelize: Sequelize): void {
    CategoryModel.init(
      {
        id: { type: DataTypes.UUID, primaryKey: true },
        name: { type: DataTypes.TEXT, allowNull: false },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      },
      // created_at belongs to the domain (it is part of the aggregate): Sequelize manages only updated_at.
      { sequelize, tableName: 'categories', createdAt: false },
    );
  }
}
