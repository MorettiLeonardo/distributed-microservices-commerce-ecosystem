import { AggregateRoot } from '@ecommerce/ddd';
import {
  ImageUploadNotExpirableError,
  UnsupportedImageTypeError,
} from '#src/domain/errors/image-upload.error.js';
import type { ProductId, ProductImageId } from '#src/domain/value-objects/identifiers.js';

export const ImageUploadStatus = {
  Pending: 'pending',
  Attached: 'attached',
  Rejected: 'rejected',
  Expired: 'expired',
} as const;
export type ImageUploadStatus = (typeof ImageUploadStatus)[keyof typeof ImageUploadStatus];

/** K4: what the image processor accepts; the declared type is re-checked against the bytes. */
export const AllowedImageType = {
  Jpeg: 'image/jpeg',
  Png: 'image/png',
  Webp: 'image/webp',
} as const;
export type AllowedImageType = (typeof AllowedImageType)[keyof typeof AllowedImageType];

/** K4: enforced by S3 itself through the upload policy. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** How long the signed upload permission lasts. */
export const UPLOAD_WINDOW_MS = 5 * 60_000;

/** An upload made at the last second still goes through the processor after the window closes. */
export const PROCESSING_GRACE_MS = 10 * 60_000;

export type ImageUploadProps = {
  /** Becomes the `ProductImageId` once attached, so the id is the same end to end. */
  id: ProductImageId;
  productId: ProductId;
  contentType: AllowedImageType;
  status: ImageUploadStatus;
  requestedAt: Date;
  expiresAt: Date;
};

/**
 * An admin's permission to upload one image for a product, tracked until the processed image is
 * attached or rejected, or the upload expires. Its own aggregate so requesting an upload does not
 * bump the product's version. Records no events: nobody reacts to them yet.
 */
export class ImageUpload extends AggregateRoot<never> {
  private constructor(private props: ImageUploadProps) {
    super();
  }

  static request(input: {
    id: ProductImageId;
    productId: ProductId;
    contentType: string;
    now: Date;
  }): ImageUpload {
    return new ImageUpload({
      id: input.id,
      productId: input.productId,
      contentType: validContentType(input.contentType),
      status: ImageUploadStatus.Pending,
      requestedAt: input.now,
      expiresAt: new Date(input.now.getTime() + UPLOAD_WINDOW_MS),
    });
  }

  static restore(props: ImageUploadProps): ImageUpload {
    return new ImageUpload({ ...props });
  }

  get id(): ProductImageId {
    return this.props.id;
  }

  get productId(): ProductId {
    return this.props.productId;
  }

  get contentType(): AllowedImageType {
    return this.props.contentType;
  }

  get status(): ImageUploadStatus {
    return this.props.status;
  }

  get requestedAt(): Date {
    return this.props.requestedAt;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  /** Still able to receive a file; open uploads count toward the product's image limit. */
  isOpen(now: Date): boolean {
    return this.props.status === ImageUploadStatus.Pending && now < this.props.expiresAt;
  }

  expire(now: Date): void {
    if (this.props.status === ImageUploadStatus.Expired) return;
    const graceOver = now.getTime() >= this.props.expiresAt.getTime() + PROCESSING_GRACE_MS;
    if (this.props.status !== ImageUploadStatus.Pending || !graceOver)
      throw new ImageUploadNotExpirableError();

    this.props = { ...this.props, status: ImageUploadStatus.Expired };
  }
}

function validContentType(raw: string): AllowedImageType {
  const allowed = Object.values(AllowedImageType);
  const type = allowed.find((known) => known === raw);
  if (!type) throw new UnsupportedImageTypeError(allowed);
  return type;
}
