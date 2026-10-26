import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { type CryptoKey, exportJWK, generateKeyPair, type JWK, SignJWT } from 'jose';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthUnavailableError, JwksAccessTokenVerifier } from '../../src/index.js';

const ISSUER = 'ecommerce-identity';
const AUDIENCE = 'ecommerce';

type SigningKey = { kid: string; privateKey: CryptoKey; publicJwk: JWK };

async function newKey(kid: string): Promise<SigningKey> {
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  return { kid, privateKey, publicJwk: { ...(await exportJWK(publicKey)), kid, alg: 'ES256' } };
}

const validPayload = { email: 'ann@example.com', emailVerified: true, role: 'admin' };

function sign(
  key: SigningKey,
  options: { payload?: Record<string, unknown>; audience?: string; expiresIn?: string } = {},
) {
  return new SignJWT(options.payload ?? validPayload)
    .setProtectedHeader({ alg: 'ES256', kid: key.kid })
    .setSubject('user-1')
    .setIssuer(ISSUER)
    .setAudience(options.audience ?? AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(options.expiresIn ?? '5m')
    .sign(key.privateKey);
}

/** A real HTTP JWKS endpoint whose keys and behavior each test controls. */
class FakeJwksServer {
  keys: SigningKey[] = [];
  mode: 'ok' | 'error' | 'hang' = 'ok';
  requests = 0;
  private readonly server: Server = createServer((_req, res) => {
    this.requests += 1;
    if (this.mode === 'hang') return;
    if (this.mode === 'error') {
      res.writeHead(500).end();
      return;
    }
    res
      .writeHead(200, { 'content-type': 'application/json' })
      .end(JSON.stringify({ keys: this.keys.map((key) => key.publicJwk) }));
  });

  async start(): Promise<string> {
    await new Promise<void>((resolve) => this.server.listen(0, resolve));
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}/.well-known/jwks.json`;
  }

  stop(): Promise<void> {
    this.server.closeAllConnections();
    return new Promise((resolve) => this.server.close(() => resolve()));
  }
}

describe('JwksAccessTokenVerifier', () => {
  let jwks: FakeJwksServer;
  let jwksUrl: string;
  let keyA: SigningKey;

  const verifier = (options: { cooldownMs?: number; timeoutMs?: number } = {}) =>
    new JwksAccessTokenVerifier({ jwksUrl, issuer: ISSUER, audience: AUDIENCE, ...options });

  beforeEach(async () => {
    jwks = new FakeJwksServer();
    jwksUrl = await jwks.start();
    keyA = await newKey('key-a');
    jwks.keys = [keyA];
  });

  afterEach(() => jwks.stop());

  it('returns the claims of a valid token', async () => {
    expect(await verifier().verify(await sign(keyA))).toEqual({
      userId: 'user-1',
      email: 'ann@example.com',
      emailVerified: true,
      role: 'admin',
    });
  });

  it('caches the keys instead of fetching them for every token', async () => {
    const tokens = verifier();
    await tokens.verify(await sign(keyA));
    await tokens.verify(await sign(keyA));

    expect(jwks.requests).toBe(1);
  });

  describe('invalid tokens (null ⇒ 401)', () => {
    it('rejects an expired token', async () => {
      expect(await verifier().verify(await sign(keyA, { expiresIn: '-1m' }))).toBeNull();
    });

    it('rejects a token meant for another audience', async () => {
      expect(await verifier().verify(await sign(keyA, { audience: 'someone-else' }))).toBeNull();
    });

    it('rejects a token signed by a key the JWKS does not publish', async () => {
      const stranger = await newKey('key-a'); // same kid, different key: signature mismatch
      expect(await verifier().verify(await sign(stranger))).toBeNull();
      expect(await verifier().verify(await sign(await newKey('unknown-kid')))).toBeNull();
    });

    it('rejects a correctly signed token whose claims break the contract', async () => {
      const tokens = verifier();
      const { role: _role, ...withoutRole } = validPayload;

      expect(await tokens.verify(await sign(keyA, { payload: withoutRole }))).toBeNull();
      expect(
        await tokens.verify(await sign(keyA, { payload: { ...validPayload, role: 'root' } })),
      ).toBeNull();
    });

    it('rejects garbage', async () => {
      expect(await verifier().verify('not-a-jwt')).toBeNull();
    });
  });

  it('picks up a rotated key by refetching on an unknown kid', async () => {
    const tokens = verifier({ cooldownMs: 0 });
    await tokens.verify(await sign(keyA));

    const keyB = await newKey('key-b');
    jwks.keys = [keyA, keyB];

    expect(await tokens.verify(await sign(keyB))).toMatchObject({ userId: 'user-1' });
    expect(jwks.requests).toBe(2);
  });

  describe('JWKS unavailable (throws ⇒ 503)', () => {
    it('throws when the JWKS answers with an error', async () => {
      jwks.mode = 'error';
      await expect(verifier().verify(await sign(keyA))).rejects.toThrow(AuthUnavailableError);
    });

    it('throws when the JWKS does not answer in time', async () => {
      jwks.mode = 'hang';
      await expect(verifier({ timeoutMs: 200 }).verify(await sign(keyA))).rejects.toThrow(
        AuthUnavailableError,
      );
    });

    it('throws when nothing listens at the JWKS URL', async () => {
      const gone = new FakeJwksServer();
      const deadUrl = await gone.start();
      await gone.stop();
      const tokens = new JwksAccessTokenVerifier({
        jwksUrl: deadUrl,
        issuer: ISSUER,
        audience: AUDIENCE,
      });

      await expect(tokens.verify(await sign(keyA))).rejects.toThrow(AuthUnavailableError);
    });
  });
});
