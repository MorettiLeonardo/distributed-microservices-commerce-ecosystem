import { PasswordTooLongError, PasswordTooShortError } from '../errors/password.error.js';

const MIN_LENGTH = 8;
/** bcrypt silently truncates input beyond 72 bytes (ADR 0007). */
const MAX_BYTES = 72;

/**
 * A plain-text password that satisfies the password policy.
 * Lives only long enough to be hashed; never persisted and never logged.
 */
export class Password {
  private constructor(readonly value: string) {}

  static create(raw: string): Password {
    // Count code points, not UTF-16 units, so "🔒" counts as one character.
    if ([...raw].length < MIN_LENGTH) {
      throw new PasswordTooShortError(MIN_LENGTH);
    }
    if (new TextEncoder().encode(raw).length > MAX_BYTES) {
      throw new PasswordTooLongError(MAX_BYTES);
    }
    return new Password(raw);
  }

  toString(): string {
    return '[REDACTED]';
  }

  toJSON(): string {
    return '[REDACTED]';
  }
}
