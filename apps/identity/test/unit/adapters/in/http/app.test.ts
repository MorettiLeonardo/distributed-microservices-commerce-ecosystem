import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InMemoryLoginAttemptLimiter } from '../../../../support/in-memory-login-attempt-limiter.js';
import { startTestServer, type TestServer } from '../../../../support/http-server.js';

const credentials = { email: 'john@example.com', password: 'correct horse' };

describe('HTTP adapter', () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await startTestServer();
  });

  afterEach(async () => {
    await server.close();
  });

  async function register(): Promise<void> {
    await server.request('/v1/auth/register', { json: credentials });
  }

  async function login(): Promise<{ accessToken: string; refreshToken: string }> {
    const response = await server.request('/v1/auth/login', { json: credentials });
    expect(response.status).toBe(200);
    return (await response.json()) as { accessToken: string; refreshToken: string };
  }

  function lastEmailToken(): string {
    const message = server.ctx.emailSender.sent.at(-1);
    if (!message || !('token' in message)) throw new Error('No email with a token was sent');
    return message.token;
  }

  describe('auth flow', () => {
    it('answers 202 to register, whether or not the email is taken', async () => {
      const first = await server.request('/v1/auth/register', { json: credentials });
      const second = await server.request('/v1/auth/register', { json: credentials });

      expect([first.status, second.status]).toEqual([202, 202]);
      expect(await second.text()).toBe(await first.text());
    });

    it('verifies the email with the emailed token', async () => {
      await register();

      const response = await server.request('/v1/auth/verify-email', {
        json: { token: lastEmailToken() },
      });

      expect(response.status).toBe(204);
    });

    it('logs in and returns the current user for the issued access token', async () => {
      await register();
      const { accessToken } = await login();

      const response = await server.request('/v1/users/me', {
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        email: 'john@example.com',
        emailVerified: false,
        status: 'pending_verification',
      });
    });

    it('rotates the refresh token and rejects the old one as reuse', async () => {
      await register();
      const { refreshToken } = await login();

      const rotated = await server.request('/v1/auth/refresh', { json: { refreshToken } });
      const reused = await server.request('/v1/auth/refresh', { json: { refreshToken } });

      expect(rotated.status).toBe(200);
      expect(reused.status).toBe(401);
      expect(await reused.json()).toMatchObject({ code: 'REFRESH_TOKEN_REUSE_DETECTED' });
    });

    it('answers 204 to logout and 202 to forgot-password, then resets the password', async () => {
      await register();
      const { refreshToken } = await login();

      expect((await server.request('/v1/auth/logout', { json: { refreshToken } })).status).toBe(
        204,
      );
      const forgot = await server.request('/v1/auth/forgot-password', {
        json: { email: credentials.email },
      });
      const reset = await server.request('/v1/auth/reset-password', {
        json: { token: lastEmailToken(), newPassword: 'new password 123' },
      });

      expect(forgot.status).toBe(202);
      expect(reset.status).toBe(204);
    });
  });

  describe('Problem Details', () => {
    it('maps a domain error to its status, code and RFC 9457 body', async () => {
      const response = await server.request('/v1/auth/register', {
        json: { email: 'john@example.com', password: 'short' },
      });

      expect(response.status).toBe(422);
      expect(response.headers.get('content-type')).toContain('application/problem+json');
      expect(await response.json()).toEqual({
        type: 'https://errors.ecommerce.dev/password-too-short',
        title: 'Password must have at least 8 characters',
        status: 422,
        instance: '/v1/auth/register',
        code: 'PASSWORD_TOO_SHORT',
        correlationId: response.headers.get('x-correlation-id'),
      });
    });

    it('answers 400 with every invalid field when the body fails validation', async () => {
      const response = await server.request('/v1/auth/login', { json: { email: 42 } });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        code: 'VALIDATION_FAILED',
        errors: [{ path: 'email' }, { path: 'password' }],
      });
    });

    it('answers 400 to malformed JSON', async () => {
      const response = await server.request('/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"email":',
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: 'MALFORMED_REQUEST' });
    });

    it('answers 423 with Retry-After once the account is locked', async () => {
      await register();
      for (let i = 0; i < InMemoryLoginAttemptLimiter.MAX_FAILURES; i++) {
        await server.request('/v1/auth/login', {
          json: { ...credentials, password: 'wrong pass' },
        });
      }

      const response = await server.request('/v1/auth/login', { json: credentials });

      expect(response.status).toBe(423);
      expect(response.headers.get('retry-after')).toBeTruthy();
    });

    it('answers 404 as a problem for unknown routes', async () => {
      const response = await server.request('/v1/nothing-here');

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('authentication', () => {
    it.each([
      ['no header', {}],
      ['a malformed token', { authorization: 'Bearer not-a-jwt' }],
      ['another scheme', { authorization: 'Basic am9objpwYXNz' }],
    ])('answers 401 with WWW-Authenticate for %s', async (_case, headers) => {
      const response = await server.request('/v1/users/me', { headers });

      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toBe('Bearer');
    });
  });

  describe('correlation id', () => {
    it('echoes a safe incoming correlation id', async () => {
      const response = await server.request('/health/live', {
        headers: { 'x-correlation-id': 'trace-123' },
      });

      expect(response.headers.get('x-correlation-id')).toBe('trace-123');
    });

    it('replaces an unsafe incoming correlation id with a generated one', async () => {
      const response = await server.request('/health/live', {
        headers: { 'x-correlation-id': 'evil"}{"level":60' },
      });

      expect(response.headers.get('x-correlation-id')).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('health and keys', () => {
    it('answers 503 on /health/ready when a dependency check fails', async () => {
      await server.close();
      server = await startTestServer({
        readinessChecks: [
          {
            name: 'database',
            check: async () => {
              throw new Error('connection refused');
            },
          },
        ],
      });

      const response = await server.request('/health/ready');

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        status: 'failing',
        checks: [{ name: 'database', status: 'failing' }],
      });
    });

    it('publishes the public signing key without its private part', async () => {
      const response = await server.request('/.well-known/jwks.json');
      const body = (await response.json()) as { keys: Record<string, unknown>[] };

      expect(response.headers.get('cache-control')).toBe('public, max-age=300');
      expect(body.keys).toHaveLength(1);
      expect(body.keys[0]).toMatchObject({ kty: 'EC', crv: 'P-256', alg: 'ES256', use: 'sig' });
      expect(body.keys[0]).not.toHaveProperty('d');
    });
  });
});
