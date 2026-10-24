import { exportJWK, generateKeyPair, type JWK } from 'jose';
import { beforeEach, describe, expect, it } from 'vitest';
import { JoseAccessTokens } from '../../../../../src/adapters/out/security/jose.access-tokens.js';
import { UserId } from '../../../../../src/domain/value-objects/identifiers.js';
import { FakeClock } from '../../../../support/fakes.js';

const TTL_MS = 15 * 60_000;
const claims = { userId: UserId('user-1'), email: 'john@example.com', emailVerified: true };

async function newPrivateJwk(): Promise<JWK> {
  const { privateKey } = await generateKeyPair('ES256', { extractable: true });
  return exportJWK(privateKey);
}

describe('JoseAccessTokens', () => {
  let clock: FakeClock;
  let privateJwk: JWK;
  let tokens: JoseAccessTokens;

  const create = (jwk: JWK, overrides: { issuer?: string; audience?: string } = {}) =>
    JoseAccessTokens.fromPrivateJwk(jwk, {
      issuer: 'identity',
      audience: 'ecommerce',
      ttlMs: TTL_MS,
      clock,
      ...overrides,
    });

  beforeEach(async () => {
    clock = new FakeClock(new Date('2026-10-19T12:00:00.000Z'));
    privateJwk = await newPrivateJwk();
    tokens = await create(privateJwk);
  });

  it('verifies the tokens it issues, returning the same claims', async () => {
    const { token } = await tokens.issue(claims);

    expect(await tokens.verify(token)).toEqual(claims);
  });

  it('reports an expiry equal to the exp claim', async () => {
    const { token, expiresAt } = await tokens.issue(claims);
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString());

    expect(expiresAt).toEqual(new Date('2026-10-19T12:15:00.000Z'));
    expect(payload.exp * 1000).toBe(expiresAt.getTime());
  });

  it('rejects an expired token', async () => {
    const { token } = await tokens.issue(claims);
    clock.advance(TTL_MS + 1000);

    expect(await tokens.verify(token)).toBeNull();
  });

  it('rejects a token signed with another key', async () => {
    const other = await create(await newPrivateJwk());
    const { token } = await other.issue(claims);

    expect(await tokens.verify(token)).toBeNull();
  });

  it('rejects a token meant for another audience', async () => {
    const other = await create(privateJwk, { audience: 'someone-else' });
    const { token } = await other.issue(claims);

    expect(await tokens.verify(token)).toBeNull();
  });

  it('rejects a tampered payload', async () => {
    const { token } = await tokens.issue(claims);
    const [header, , signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'admin', email: 'x', emailVerified: true }));

    expect(
      await tokens.verify(`${header}.${forged.toString('base64url')}.${signature}`),
    ).toBeNull();
  });

  it('puts the public key thumbprint in the kid header and in the JWKS', async () => {
    const { token } = await tokens.issue(claims);
    const header = JSON.parse(Buffer.from(token.split('.')[0] ?? '', 'base64url').toString());
    const [publicKey] = tokens.jwks().keys;

    expect(header.kid).toBe(publicKey?.kid);
    expect(publicKey).not.toHaveProperty('d');
  });

  it('refuses a key that is not a P-256 private key', async () => {
    const { d: _d, ...publicOnly } = privateJwk;

    await expect(create(publicOnly)).rejects.toThrow('P-256 EC private JWK');
  });
});
