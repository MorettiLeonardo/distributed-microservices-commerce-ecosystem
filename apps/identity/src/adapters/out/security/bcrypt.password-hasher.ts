import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import type { PasswordHasher } from '../../../application/ports/password-hasher.port.js';
import { PasswordHash } from '../../../domain/value-objects/identifiers.js';
import type { Password } from '../../../domain/value-objects/password.value-object.js';

export class BcryptPasswordHasher implements PasswordHasher {
  /**
   * Compared against when the user does not exist, so that path costs the same as a real
   * comparison (ADR 0007). Same cost as real hashes, otherwise the timing would still differ.
   */
  readonly #dummyHash: Promise<string>;

  constructor(private readonly cost: number) {
    this.#dummyHash = bcrypt.hash(randomBytes(16).toString('hex'), cost);
  }

  async hash(password: Password): Promise<PasswordHash> {
    return PasswordHash(await bcrypt.hash(password.value, this.cost));
  }

  async verify(plain: string, hash: PasswordHash | null): Promise<boolean> {
    if (hash === null) {
      await bcrypt.compare(plain, await this.#dummyHash);
      return false;
    }
    return bcrypt.compare(plain, hash);
  }
}
