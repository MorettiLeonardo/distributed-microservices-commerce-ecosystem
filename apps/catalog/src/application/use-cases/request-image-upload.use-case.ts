import { ImageUpload, MAX_IMAGE_BYTES } from '#src/domain/entities/image-upload.entity.js';
import { MAX_IMAGES } from '#src/domain/entities/product.entity.js';
import { TooManyImagesError } from '#src/domain/errors/product.error.js';
import { ProductId, ProductImageId } from '#src/domain/value-objects/identifiers.js';
import { ProductNotFoundError } from '#src/application/errors/product-not-found.error.js';
import type { Clock } from '#src/application/ports/clock.port.js';
import type { IdGenerator } from '#src/application/ports/id-generator.port.js';
import type { ImageUploadRepository } from '#src/application/ports/image-upload.repository.port.js';
import type { ImageUploadSigner } from '#src/application/ports/image-upload-signer.port.js';
import type { ProductRepository } from '#src/application/ports/product.repository.port.js';

export type RequestImageUploadInput = {
  productId: string;
  contentType: string;
};

export type ImageUploadView = {
  imageId: ProductImageId;
  url: string;
  fields: Record<string, string>;
  expiresAt: Date;
};

export class RequestImageUpload {
  constructor(
    private readonly deps: {
      products: ProductRepository;
      imageUploads: ImageUploadRepository;
      signer: ImageUploadSigner;
      idGenerator: IdGenerator;
      clock: Clock;
    },
  ) {}

  /**
   * Throws `ProductNotFoundError`, or `TooManyImagesError` when attached images plus open uploads
   * already reach the limit. Two concurrent requests can both pass that count; `attachImage` is
   * the real guarantee, the count only spares admins uploads that could never be attached.
   */
  async execute(input: RequestImageUploadInput): Promise<ImageUploadView> {
    const now = this.deps.clock.now();
    // Built first: an unsupported type fails without any I/O.
    const upload = ImageUpload.request({
      id: ProductImageId(this.deps.idGenerator.generate()),
      productId: ProductId(input.productId),
      contentType: input.contentType,
      now,
    });

    const found = await this.deps.products.findById(upload.productId);
    if (!found) throw new ProductNotFoundError();

    const open = await this.deps.imageUploads.countOpen(upload.productId, now);
    if (found.product.images.length + open >= MAX_IMAGES) throw new TooManyImagesError(MAX_IMAGES);

    // Signed before saving: if signing fails nothing is stored, and the permission only leaves
    // this service after its upload is saved, so no file can arrive for an unknown upload.
    const permission = await this.deps.signer.sign({
      productId: upload.productId,
      imageId: upload.id,
      contentType: upload.contentType,
      maxBytes: MAX_IMAGE_BYTES,
      expiresAt: upload.expiresAt,
    });
    await this.deps.imageUploads.save(upload);

    return { imageId: upload.id, ...permission, expiresAt: upload.expiresAt };
  }
}
