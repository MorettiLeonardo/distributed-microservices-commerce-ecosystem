import type { Clock } from '#src/application/ports/clock.port.js';
import type { IdGenerator } from '#src/application/ports/id-generator.port.js';
import type {
  ImageUploadPermission,
  ImageUploadSigner,
  ImageUploadSignRequest,
} from '#src/application/ports/image-upload-signer.port.js';

export class FakeClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

/** The n-th id handed out by `SequentialIdGenerator`: UUID-shaped, so HTTP validation accepts it. */
export const testId = (n: number): string =>
  `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`;

export class SequentialIdGenerator implements IdGenerator {
  #next = 0;

  generate(): string {
    this.#next += 1;
    return testId(this.#next);
  }
}

/** Records what it was asked to sign and answers with predictable fields; can be made to fail. */
export class FakeImageUploadSigner implements ImageUploadSigner {
  readonly requests: ImageUploadSignRequest[] = [];
  #failure: Error | null = null;

  failWith(error: Error): void {
    this.#failure = error;
  }

  async sign(request: ImageUploadSignRequest): Promise<ImageUploadPermission> {
    if (this.#failure) throw this.#failure;
    this.requests.push({ ...request });
    return { url: 'http://uploads.test', fields: { key: `signed-${request.imageId}` } };
  }
}
