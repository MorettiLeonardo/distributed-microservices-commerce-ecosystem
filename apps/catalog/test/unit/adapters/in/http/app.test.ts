import { afterEach, describe, expect, it } from 'vitest';
import { startTestServer, type TestServer } from '../../../../support/http-server.js';

describe('HTTP adapter', () => {
  let server: TestServer;

  afterEach(() => server.close());

  describe('health', () => {
    it('answers liveness without checking dependencies', async () => {
      server = await startTestServer({
        readinessChecks: [{ name: 'postgres', check: () => Promise.reject(new Error('down')) }],
      });

      const response = await server.request('/health/live');

      expect(response.status).toBe(200);
    });

    it('is ready when every dependency answers', async () => {
      server = await startTestServer({
        readinessChecks: [
          { name: 'postgres', check: async () => {} },
          { name: 'redis', check: async () => {} },
        ],
      });

      const response = await server.request('/health/ready');

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        status: 'ok',
        checks: [
          { name: 'postgres', status: 'ok' },
          { name: 'redis', status: 'ok' },
        ],
      });
    });

    it('answers 503 when a dependency fails', async () => {
      server = await startTestServer({
        readinessChecks: [{ name: 'redis', check: () => Promise.reject(new Error('down')) }],
      });

      const response = await server.request('/health/ready');

      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ status: 'failing' });
    });
  });

  it('answers 404 as a problem for unknown routes, echoing the correlation id', async () => {
    server = await startTestServer();

    const response = await server.request('/v1/nope', {
      headers: { 'x-correlation-id': 'trace-1' },
    });

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(response.headers.get('x-correlation-id')).toBe('trace-1');
    expect(await response.json()).toMatchObject({ code: 'NOT_FOUND', correlationId: 'trace-1' });
  });
});
