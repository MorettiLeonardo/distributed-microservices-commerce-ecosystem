import type { AllowedImageType } from '#src/domain/entities/image-upload.entity.js';
import type { ProductId, ProductImageId } from '#src/domain/value-objects/identifiers.js';

export type ImageUploadSignRequest = {
  productId: ProductId;
  imageId: ProductImageId;
  contentType: AllowedImageType;
  maxBytes: number;
  expiresAt: Date;
};

/** A browser-style form upload: POST `fields` plus the file (last) to `url`. */
export type ImageUploadPermission = {
  url: string;
  fields: Record<string, string>;
};

/**
 * Grants a client permission to upload one image straight to storage. The permission itself
 * enforces the size, type and destination, so the file never passes through this service.
 */
export interface ImageUploadSigner {
  sign(request: ImageUploadSignRequest): Promise<ImageUploadPermission>;
}
