import { DomainError } from '@ecommerce/ddd';

export class UnsupportedImageTypeError extends DomainError {
  override readonly code = 'UNSUPPORTED_IMAGE_TYPE';

  constructor(readonly allowed: readonly string[]) {
    super(`Image type must be one of: ${allowed.join(', ')}`);
  }
}

/** Only a pending upload whose processing grace is over can expire; anything else is a caller bug. */
export class ImageUploadNotExpirableError extends DomainError {
  override readonly code = 'IMAGE_UPLOAD_NOT_EXPIRABLE';

  constructor() {
    super('Image upload cannot expire yet, or is already settled');
  }
}
