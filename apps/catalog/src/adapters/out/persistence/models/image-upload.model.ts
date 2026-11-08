import {
  type CreationOptional,
  DataTypes,
  type InferAttributes,
  type InferCreationAttributes,
  Model,
  type Sequelize,
} from 'sequelize';

/** Persistence shape of the ImageUpload aggregate. Never leaves `adapters/out/persistence`. */
export class ImageUploadModel extends Model<
  InferAttributes<ImageUploadModel>,
  InferCreationAttributes<ImageUploadModel>
> {
  declare id: string;
  declare productId: string;
  declare contentType: string;
  declare status: string;
  declare requestedAt: Date;
  declare expiresAt: Date;
  declare updatedAt: CreationOptional<Date>;

  static initialize(sequelize: Sequelize): void {
    ImageUploadModel.init(
      {
        id: { type: DataTypes.UUID, primaryKey: true },
        productId: { type: DataTypes.UUID, allowNull: false },
        contentType: { type: DataTypes.TEXT, allowNull: false },
        status: { type: DataTypes.TEXT, allowNull: false },
        requestedAt: { type: DataTypes.DATE, allowNull: false },
        expiresAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      },
      // requested_at plays created_at and belongs to the domain: Sequelize manages only updated_at.
      { sequelize, tableName: 'image_uploads', createdAt: false },
    );
  }
}
