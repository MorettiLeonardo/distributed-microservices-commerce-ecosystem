import { Op } from 'sequelize';
import type { ImageUploadRepository } from '#src/application/ports/image-upload.repository.port.js';
import { type ImageUpload, ImageUploadStatus } from '#src/domain/entities/image-upload.entity.js';
import type { ProductId } from '#src/domain/value-objects/identifiers.js';
import { ImageUploadModel } from '#src/adapters/out/persistence/models/image-upload.model.js';

export class SequelizeImageUploadRepository implements ImageUploadRepository {
  async save(upload: ImageUpload): Promise<void> {
    await ImageUploadModel.upsert({
      id: upload.id,
      productId: upload.productId,
      contentType: upload.contentType,
      status: upload.status,
      requestedAt: upload.requestedAt,
      expiresAt: upload.expiresAt,
    });
  }

  /** Matches the partial index `image_uploads_pending_index`. */
  async countOpen(productId: ProductId, now: Date): Promise<number> {
    return ImageUploadModel.count({
      where: { productId, status: ImageUploadStatus.Pending, expiresAt: { [Op.gt]: now } },
    });
  }
}
