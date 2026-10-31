import {
  type CreationOptional,
  DataTypes,
  type InferAttributes,
  type InferCreationAttributes,
  Model,
  type NonAttribute,
  type Sequelize,
} from 'sequelize';

/** Persistence shape of the Product aggregate root. Never leaves `adapters/out/persistence`. */
export class ProductModel extends Model<
  InferAttributes<ProductModel>,
  InferCreationAttributes<ProductModel>
> {
  declare id: string;
  declare categoryId: string;
  declare name: string;
  declare description: string;
  declare priceAmount: number | null;
  declare priceCurrency: string | null;
  declare weightGrams: number | null;
  declare status: string;
  declare createdAt: Date;
  declare publishedAt: Date | null;
  declare updatedAt: CreationOptional<Date>;
  /** Present only when loaded with `include`. */
  declare images?: NonAttribute<ProductImageModel[]>;

  static initialize(sequelize: Sequelize): void {
    ProductModel.init(
      {
        id: { type: DataTypes.UUID, primaryKey: true },
        categoryId: { type: DataTypes.UUID, allowNull: false },
        name: { type: DataTypes.TEXT, allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: false },
        priceAmount: { type: DataTypes.INTEGER, allowNull: true },
        priceCurrency: { type: DataTypes.TEXT, allowNull: true },
        weightGrams: { type: DataTypes.INTEGER, allowNull: true },
        status: { type: DataTypes.TEXT, allowNull: false },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        publishedAt: { type: DataTypes.DATE, allowNull: true },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      },
      // created_at belongs to the domain (it is part of the aggregate): Sequelize manages only updated_at.
      { sequelize, tableName: 'products', createdAt: false },
    );
  }
}

/** One image of a product; `position` is its display order. */
export class ProductImageModel extends Model<
  InferAttributes<ProductImageModel>,
  InferCreationAttributes<ProductImageModel>
> {
  declare id: string;
  declare productId: string;
  declare position: number;
  declare key: string;

  static initialize(sequelize: Sequelize): void {
    ProductImageModel.init(
      {
        id: { type: DataTypes.UUID, primaryKey: true },
        productId: { type: DataTypes.UUID, allowNull: false },
        position: { type: DataTypes.SMALLINT, allowNull: false },
        key: { type: DataTypes.TEXT, allowNull: false },
      },
      { sequelize, tableName: 'product_images', timestamps: false },
    );
  }
}

/** Called after both models are initialized. Lets `findById` load the aggregate in one query. */
export function associateProductModels(): void {
  ProductModel.hasMany(ProductImageModel, { as: 'images', foreignKey: 'productId' });
}
