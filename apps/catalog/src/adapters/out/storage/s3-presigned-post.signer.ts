import type { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import type {
  ImageUploadPermission,
  ImageUploadSigner,
  ImageUploadSignRequest,
} from '#src/application/ports/image-upload-signer.port.js';

/** Where clients drop files; the image processor is triggered only by this prefix. */
export const ORIGINALS_PREFIX = 'originals/';

/**
 * Signs a presigned POST rather than a presigned PUT: only a POST policy can carry
 * `content-length-range`, so S3 itself refuses oversized files before anything processes them.
 * The policy also pins the key and the content type.
 */
export class S3PresignedPostSigner implements ImageUploadSigner {
  constructor(
    private readonly s3: S3Client,
    private readonly bucket: string,
  ) {}

  async sign(request: ImageUploadSignRequest): Promise<ImageUploadPermission> {
    const { url, fields } = await createPresignedPost(this.s3, {
      Bucket: this.bucket,
      Key: `${ORIGINALS_PREFIX}${request.productId}/${request.imageId}`,
      Conditions: [['content-length-range', 1, request.maxBytes]],
      // The SDK turns every field (and the key) into an exact-match condition of the policy.
      Fields: { 'Content-Type': request.contentType },
      // Rounded down: the permission may close a moment before the upload's window, never after.
      Expires: Math.floor((request.expiresAt.getTime() - Date.now()) / 1000),
    });
    return { url, fields };
  }
}
