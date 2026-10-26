import { JwksAccessTokenVerifier } from '@ecommerce/auth';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from '../../../../support/http-server.js';

const credentials = { email: 'john@example.com', password: 'correct horse' };

/**
 * Contract test: a token issued by identity, with keys served by identity's real JWKS endpoint,
 * passes the verifier every other service uses. Breaks here before it breaks a consumer.
 */
describe('access token contract (identity → @ecommerce/auth)', () => {
  let server: TestServer;

  beforeEach(async () => {
    // The consumer checks expiry against the real clock, so identity must issue on it too.
    server = await startTestServer({ now: new Date() });
  });

  afterEach(async () => {
    await server.close();
  });

  it('issues tokens that consumers verify through the published JWKS', async () => {
    await server.request('/v1/auth/register', { json: credentials });
    const login = await server.request('/v1/auth/login', { json: credentials });
    const { accessToken } = (await login.json()) as { accessToken: string };

    const verifier = new JwksAccessTokenVerifier({
      jwksUrl: `${server.baseUrl}/.well-known/jwks.json`,
      issuer: 'test-issuer',
      audience: 'test-audience',
    });

    expect(await verifier.verify(accessToken)).toEqual({
      userId: expect.any(String),
      email: 'john@example.com',
      emailVerified: false,
      role: 'customer',
    });
  });
});
