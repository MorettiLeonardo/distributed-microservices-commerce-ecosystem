import { describe, expect, it } from 'vitest';
import { ImageUpload, type ImageUploadProps } from '#src/domain/entities/image-upload.entity.js';
import {
  ImageUploadNotExpirableError,
  UnsupportedImageTypeError,
} from '#src/domain/errors/image-upload.error.js';
import { ProductId, ProductImageId } from '#src/domain/value-objects/identifiers.js';

const now = new Date('2026-11-08T12:00:00.000Z');
const minutes = (n: number) => new Date(now.getTime() + n * 60_000);

function requestUpload(contentType = 'image/png'): ImageUpload {
  return ImageUpload.request({
    id: ProductImageId('img-1'),
    productId: ProductId('prod-1'),
    contentType,
    now,
  });
}

function restoreUpload(overrides: Partial<ImageUploadProps> = {}): ImageUpload {
  return ImageUpload.restore({
    id: ProductImageId('img-1'),
    productId: ProductId('prod-1'),
    contentType: 'image/png',
    status: 'pending',
    requestedAt: now,
    expiresAt: minutes(5),
    ...overrides,
  });
}

describe('ImageUpload', () => {
  describe('request', () => {
    it('starts pending, open for a 5-minute upload window, and records nothing', () => {
      const upload = requestUpload();

      expect(upload.id).toBe('img-1');
      expect(upload.productId).toBe('prod-1');
      expect(upload.contentType).toBe('image/png');
      expect(upload.status).toBe('pending');
      expect(upload.requestedAt).toEqual(now);
      expect(upload.expiresAt).toEqual(minutes(5));
      expect(upload.pullEvents()).toEqual([]);
    });

    it.each(['image/jpeg', 'image/png', 'image/webp'])('accepts %s', (contentType) => {
      expect(requestUpload(contentType).contentType).toBe(contentType);
    });

    it.each(['image/gif', 'image/svg+xml', 'text/html', 'IMAGE/PNG', ''])(
      'rejects the content type %j',
      (contentType) => {
        expect(() => requestUpload(contentType)).toThrow(UnsupportedImageTypeError);
      },
    );
  });

  describe('isOpen', () => {
    it('is open while pending and before the upload window closes', () => {
      expect(restoreUpload().isOpen(minutes(4))).toBe(true);
    });

    it('is closed once the upload window closes', () => {
      expect(restoreUpload().isOpen(minutes(5))).toBe(false);
    });

    it.each(['attached', 'rejected', 'expired'] as const)('is closed when %s', (status) => {
      expect(restoreUpload({ status }).isOpen(minutes(1))).toBe(false);
    });
  });

  describe('expire', () => {
    it('expires a pending upload once the window and the processing grace are over', () => {
      const upload = restoreUpload();

      upload.expire(minutes(15));

      expect(upload.status).toBe('expired');
    });

    it('refuses while the image may still be processing', () => {
      const upload = restoreUpload();

      expect(() => upload.expire(minutes(14))).toThrow(ImageUploadNotExpirableError);
      expect(upload.status).toBe('pending');
    });

    it('is a no-op when already expired', () => {
      const upload = restoreUpload({ status: 'expired' });

      upload.expire(minutes(60));

      expect(upload.status).toBe('expired');
    });

    it.each(['attached', 'rejected'] as const)('refuses when %s', (status) => {
      expect(() => restoreUpload({ status }).expire(minutes(60))).toThrow(
        ImageUploadNotExpirableError,
      );
    });
  });
});
