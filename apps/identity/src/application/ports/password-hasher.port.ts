import type { PasswordHash } from '../../domain/value-objects/identifiers.js';
import type { Password } from '../../domain/value-objects/password.value-object.js';

export interface PasswordHasher {
  hash(password: Password): Promise<PasswordHash>;

  /**
   * Compares a plain-text password with a hash. When `hash` is null (unknown user) the
   * implementation must still spend the time of a real comparison and return false,
   * so response times do not reveal whether an account exists.
   */
  verify(plain: string, hash: PasswordHash | null): Promise<boolean>;
}
