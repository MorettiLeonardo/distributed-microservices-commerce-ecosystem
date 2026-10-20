import { describe, expect, it } from 'vitest';
import { InvalidEmailError } from '../../../../src/domain/errors/email.error.js';
import { Email } from '../../../../src/domain/value-objects/email.value-object.js';

describe('Email', () => {
  it('normalizes by trimming and lowercasing', () => {
    expect(Email.create('  John.Doe@Example.COM ').value).toBe('john.doe@example.com');
  });

  it('treats differently-cased addresses as equal', () => {
    expect(Email.create('a@b.com').equals(Email.create('A@B.COM'))).toBe(true);
  });

  it.each(['', 'plain', 'no-at.com', 'a@b', 'a b@c.com', '@b.com'])('rejects %j', (raw) => {
    expect(() => Email.create(raw)).toThrow(InvalidEmailError);
  });

  it('rejects addresses longer than 254 characters', () => {
    const raw = `${'a'.repeat(250)}@b.com`;
    expect(() => Email.create(raw)).toThrow(InvalidEmailError);
  });
});
