import { describe, expect, it } from 'vitest';
import {
  PasswordTooLongError,
  PasswordTooShortError,
} from '../../../../src/domain/errors/password.error.js';
import { Password } from '../../../../src/domain/value-objects/password.value-object.js';

describe('Password', () => {
  it('accepts a password within the policy', () => {
    expect(Password.create('correct horse').value).toBe('correct horse');
  });

  it('rejects passwords shorter than 8 characters', () => {
    expect(() => Password.create('1234567')).toThrow(PasswordTooShortError);
  });

  it('counts emojis as single characters', () => {
    expect(() => Password.create('🔒🔒🔒🔒🔒🔒🔒')).toThrow(PasswordTooShortError);
    expect(Password.create('🔒🔒🔒🔒🔒🔒🔒🔒').value).toHaveLength(16);
  });

  it('accepts exactly 72 bytes', () => {
    expect(() => Password.create('a'.repeat(72))).not.toThrow();
  });

  it('rejects more than 72 bytes, measured in UTF-8', () => {
    expect(() => Password.create('a'.repeat(73))).toThrow(PasswordTooLongError);
    // 19 emojis × 4 bytes = 76 bytes, although only 19 characters
    expect(() => Password.create('🔒'.repeat(19))).toThrow(PasswordTooLongError);
  });

  it('never reveals its value when stringified or serialized', () => {
    const password = Password.create('super-secret');
    expect(`${password}`).toBe('[REDACTED]');
    expect(JSON.stringify({ password })).toBe('{"password":"[REDACTED]"}');
  });
});
