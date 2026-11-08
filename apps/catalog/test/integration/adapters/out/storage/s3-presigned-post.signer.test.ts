import { CreateBucketCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { S3PresignedPostSigner } from '#src/adapters/out/storage/s3-presigned-post.signer.js';
import type { ImageUploadPermission } from '#src/application/ports/image-upload-signer.port.js';
import { ProductId, ProductImageId } from '#src/domain/value-objects/identifiers.js';
import { startFloci, type TestFloci } from '#test/support/floci.js';

const BUCKET = 'catalog-images-test';
const PRODUCT_ID = ProductId('0192a1f0-0000-7000-8000-0000000000a1');
const IMAGE_ID = ProductImageId('0192a1f0-0000-7000-8000-000000000101');

describe('S3PresignedPostSigner (Floci)', () => {
  let floci: TestFloci;
  let permission: ImageUploadPermission;

  beforeAll(async () => {
    floci = await startFloci();
    await floci.s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
    permission = await new S3PresignedPostSigner(floci.s3, BUCKET).sign({
      productId: PRODUCT_ID,
      imageId: IMAGE_ID,
      contentType: 'image/png',
      maxBytes: 1000,
      expiresAt: new Date(Date.now() + 5 * 60_000),
    });
  }, 120_000);

  afterAll(async () => {
    await floci?.stop();
  });

  /** Uploads like a browser form would; the file must be the last field. */
  async function upload(bytes: number, overrides: Record<string, string> = {}): Promise<number> {
    const form = new FormData();
    for (const [name, value] of Object.entries({ ...permission.fields, ...overrides })) {
      form.append(name, value);
    }
    form.append('file', new Blob([new Uint8Array(bytes)]), 'image.png');
    const response = await fetch(permission.url, { method: 'POST', body: form });
    await response.body?.cancel();
    return response.status;
  }

  it('lets the client upload the file to originals/<productId>/<imageId>', async () => {
    expect(permission.fields.key).toBe(`originals/${PRODUCT_ID}/${IMAGE_ID}`);

    expect(await upload(1000)).toBe(204);
    const stored = await floci.s3.send(
      new HeadObjectCommand({ Bucket: BUCKET, Key: permission.fields.key }),
    );
    expect(stored).toMatchObject({ ContentLength: 1000, ContentType: 'image/png' });
  });

  it('makes S3 refuse a file over the size limit', async () => {
    expect(await upload(1001)).toBe(400);
  });

  it('makes S3 refuse an empty file', async () => {
    expect(await upload(0)).toBe(400);
  });

  it('makes S3 refuse another destination', async () => {
    expect(await upload(10, { key: `originals/${PRODUCT_ID}/someone-elses` })).toBe(403);
  });

  it('makes S3 refuse another content type', async () => {
    expect(await upload(10, { 'Content-Type': 'text/html' })).toBe(403);
  });
});
