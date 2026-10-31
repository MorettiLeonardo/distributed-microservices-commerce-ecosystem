import type { AddressInfo } from 'node:net';
import type { AccessTokenClaims } from '@ecommerce/auth';
import type { ReadinessCheck, TokenVerifier } from '@ecommerce/http';
import { createApp } from '../../src/adapters/in/http/app.js';
import { CreateCategory } from '../../src/application/use-cases/create-category.use-case.js';
import { CreateProduct } from '../../src/application/use-cases/create-product.use-case.js';
import { GetProduct } from '../../src/application/use-cases/get-product.use-case.js';
import { createLogger } from '../../src/logger.js';
import { createTestContext, type TestContext } from './test-context.js';

/** Bearer tokens the fake verifier accepts. */
export const TOKENS = {
  admin: 'admin-token',
  customer: 'customer-token',
  /** Makes the verifier throw, as the JWKS verifier does when identity is unreachable. */
  unverifiable: 'unverifiable-token',
} as const;

/** Stands in for the JWKS verifier: token cryptography is tested in `@ecommerce/auth`. */
class FakeTokenVerifier implements TokenVerifier<AccessTokenClaims> {
  async verify(token: string): Promise<AccessTokenClaims | null> {
    if (token === TOKENS.unverifiable) throw new Error('JWKS unreachable');
    if (token === TOKENS.admin) return claims('admin');
    if (token === TOKENS.customer) return claims('customer');
    return null;
  }
}

const claims = (role: AccessTokenClaims['role']): AccessTokenClaims => ({
  userId: `${role}-1`,
  email: `${role}@example.com`,
  emailVerified: true,
  role,
});

export type TestServer = {
  ctx: TestContext;
  /** Sends a request; `json` is serialized as the body with the JSON content type. */
  request: (path: string, init?: RequestInit & { json?: unknown }) => Promise<Response>;
  close: () => Promise<void>;
};

/**
 * Starts the real Express app on a random port, wired to the in-memory test context and a fake
 * token verifier, so tests go through actual HTTP.
 */
export async function startTestServer(
  options: { readinessChecks?: ReadinessCheck[]; now?: Date } = {},
): Promise<TestServer> {
  const ctx = createTestContext(options.now);

  const app = createApp({
    useCases: {
      createCategory: new CreateCategory(ctx),
      createProduct: new CreateProduct(ctx),
      getProduct: new GetProduct(ctx),
    },
    accessTokenVerifier: new FakeTokenVerifier(),
    readinessChecks: options.readinessChecks ?? [],
    logger: createLogger({ level: 'silent', enabled: false }),
  });

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    ctx,
    request: (path, { json, headers, ...init } = {}) =>
      fetch(`${baseUrl}${path}`, {
        ...init,
        ...(json !== undefined && { method: init.method ?? 'POST', body: JSON.stringify(json) }),
        headers: { ...(json !== undefined && { 'content-type': 'application/json' }), ...headers },
      }),
    close: () => new Promise((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))),
  };
}
