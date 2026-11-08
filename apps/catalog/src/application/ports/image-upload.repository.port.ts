import type { ImageUpload } from '#src/domain/entities/image-upload.entity.js';
import type { ProductId } from '#src/domain/value-objects/identifiers.js';

export interface ImageUploadRepository {
  /**
   * Inserts or updates. A missing product violates a foreign key and is NOT translated: use cases
   * check the product first, so a violation here means a bug.
   */
  save(upload: ImageUpload): Promise<void>;

  /** Pending uploads of the product whose upload window is still open at `now`. */
  countOpen(productId: ProductId, now: Date): Promise<number>;
}
