import { describe, expect, it } from 'vitest';
import { BcryptPasswordHasher } from '../../../../../src/adapters/out/security/bcrypt.password-hasher.js';
import { Password } from '../../../../../src/domain/value-objects/password.value-object.js';

// The minimum cost keeps the tests fast; production uses 12.
const hasher = new BcryptPasswordHasher(4);

describe('BcryptPasswordHasher', () => {
  it('verifies the right password against its hash', async () => {
    const hash = await hasher.hash(Password.create('correct horse'));

    expect(await hasher.verify('correct horse', hash)).toBe(true);
    expect(await hasher.verify('wrong horse', hash)).toBe(false);
  });

  it('salts every hash, so equal passwords produce different hashes', async () => {
    const password = Password.create('correct horse');

    expect(await hasher.hash(password)).not.toBe(await hasher.hash(password));
  });

  it('uses the configured cost', async () => {
    expect(await hasher.hash(Password.create('correct horse'))).toMatch(/^\$2b\$04\$/);
  });

  it('returns false for a missing hash (unknown user)', async () => {
    expect(await hasher.verify('correct horse', null)).toBe(false);
  });
});
