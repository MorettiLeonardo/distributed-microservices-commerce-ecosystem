import type { AddressInfo } from 'node:net';
import type { ReadinessCheck } from '@ecommerce/http';
import { exportJWK, generateKeyPair } from 'jose';
import { createApp } from '../../src/adapters/in/http/app.js';
import { JoseAccessTokens } from '../../src/adapters/out/security/jose.access-tokens.js';
import { GetCurrentUser } from '../../src/application/use-cases/get-current-user.use-case.js';
import { Login } from '../../src/application/use-cases/login.use-case.js';
import { Logout } from '../../src/application/use-cases/logout.use-case.js';
import { RefreshSession } from '../../src/application/use-cases/refresh-session.use-case.js';
import { RegisterUser } from '../../src/application/use-cases/register-user.use-case.js';
import { RequestPasswordReset } from '../../src/application/use-cases/request-password-reset.use-case.js';
import { ResetPassword } from '../../src/application/use-cases/reset-password.use-case.js';
import { VerifyEmail } from '../../src/application/use-cases/verify-email.use-case.js';
import { createLogger } from '../../src/logger.js';
import { createTestContext, type TestContext } from './test-context.js';

export type TestServer = {
  ctx: TestContext;
  baseUrl: string;
  accessTokens: JoseAccessTokens;
  /** Sends a request; `json` is serialized as the body with the JSON content type. */
  request: (path: string, init?: RequestInit & { json?: unknown }) => Promise<Response>;
  close: () => Promise<void>;
};

/**
 * Starts the real Express app on a random port, wired to the in-memory test context and a
 * real ES256 token issuer (fresh key per server), so tests go through actual HTTP.
 */
export async function startTestServer(
  options: { readinessChecks?: ReadinessCheck[]; now?: Date } = {},
): Promise<TestServer> {
  const ctx = createTestContext(options.now);
  const { privateKey } = await generateKeyPair('ES256', { extractable: true });
  const accessTokens = await JoseAccessTokens.fromPrivateJwk(await exportJWK(privateKey), {
    issuer: 'test-issuer',
    audience: 'test-audience',
    ttlMs: 15 * 60_000,
    clock: ctx.clock,
  });
  const ports = { ...ctx, accessTokenIssuer: accessTokens };

  const app = createApp({
    useCases: {
      registerUser: new RegisterUser(ports),
      login: new Login(ports),
      refreshSession: new RefreshSession(ports),
      logout: new Logout(ports),
      verifyEmail: new VerifyEmail(ports),
      requestPasswordReset: new RequestPasswordReset(ports),
      resetPassword: new ResetPassword(ports),
      getCurrentUser: new GetCurrentUser(ports),
    },
    accessTokenVerifier: accessTokens,
    jwks: () => accessTokens.jwks(),
    readinessChecks: options.readinessChecks ?? [],
    logger: createLogger({ level: 'silent', enabled: false }),
  });

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    ctx,
    baseUrl,
    accessTokens,
    request: (path, { json, headers, ...init } = {}) =>
      fetch(`${baseUrl}${path}`, {
        ...init,
        ...(json !== undefined && { method: init.method ?? 'POST', body: JSON.stringify(json) }),
        headers: { ...(json !== undefined && { 'content-type': 'application/json' }), ...headers },
      }),
    close: () => new Promise((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))),
  };
}
