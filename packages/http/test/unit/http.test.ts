import type { AddressInfo } from 'node:net';
import { DomainError } from '@ecommerce/ddd';
import { createLogger } from '@ecommerce/logger';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  authenticate,
  createProblemDetailsHandler,
  healthRoutes,
  HttpProblem,
  notFoundHandler,
  requestLogging,
  requireRole,
} from '../../src/index.js';

class OutOfStockError extends DomainError {
  readonly code = 'OUT_OF_STOCK';
  constructor(readonly retryAfterSeconds: number) {
    super('Product is out of stock');
  }
}

class UnmappedError extends DomainError {
  readonly code = 'UNMAPPED';
}

type KnownError = OutOfStockError;

type Claims = { userId: string; role: 'customer' | 'admin' };

const CLAIMS_BY_TOKEN: Record<string, Claims> = {
  good: { userId: 'user-1', role: 'customer' },
  admin: { userId: 'user-2', role: 'admin' },
};

const verifier = {
  verify: async (token: string): Promise<Claims | null> => {
    if (token === 'unavailable') throw new Error('JWKS unreachable');
    return CLAIMS_BY_TOKEN[token] ?? null;
  },
};

let baseUrl: string;
let close: () => Promise<void>;

beforeAll(async () => {
  const app = express();
  app.use(requestLogging(createLogger({ service: 'test', level: 'silent', enabled: false })));
  app.use(express.json({ limit: '1kb' }));
  app.use(healthRoutes([{ name: 'db', check: async () => {} }]));
  app.post('/zod', (req) => {
    z.object({ name: z.string() }).parse(req.body);
  });
  app.get('/domain', () => {
    throw new OutOfStockError(30);
  });
  app.get('/unmapped', () => {
    throw new UnmappedError('not in the table');
  });
  app.get('/http-problem', () => {
    throw new HttpProblem(409, 'CONFLICT', 'Conflict', { 'X-Extra': 'yes' });
  });
  app.get('/boom', () => {
    throw new Error('secret internals');
  });
  app.get('/me', async (req, res) => {
    res.json(await authenticate(req, verifier));
  });
  app.get('/admin', async (req, res) => {
    requireRole(await authenticate(req, verifier), 'admin');
    res.json({ ok: true });
  });
  app.use(notFoundHandler);
  app.use(
    createProblemDetailsHandler({
      statusByCode: { OUT_OF_STOCK: 409 } satisfies Record<KnownError['code'], number>,
      extras: (error) =>
        error instanceof OutOfStockError
          ? { headers: { 'Retry-After': String(error.retryAfterSeconds) } }
          : {},
    }),
  );

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => new Promise((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
});

afterAll(() => close());

const request = (path: string, init?: RequestInit) => fetch(`${baseUrl}${path}`, init);
const postJson = (body: string) =>
  request('/zod', { method: 'POST', headers: { 'content-type': 'application/json' }, body });

describe('requestLogging', () => {
  it('reuses a safe incoming correlation id', async () => {
    const res = await request('/health/live', { headers: { 'x-correlation-id': 'trace-1' } });
    expect(res.headers.get('x-correlation-id')).toBe('trace-1');
  });

  it('replaces an unsafe correlation id instead of trusting it', async () => {
    const res = await request('/health/live', {
      headers: { 'x-correlation-id': 'evil value\twith spaces' },
    });
    expect(res.headers.get('x-correlation-id')).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('problem details', () => {
  it('maps a known domain error to its status, extras and the RFC 9457 shape', async () => {
    const res = await request('/domain', { headers: { 'x-correlation-id': 'trace-2' } });

    expect(res.status).toBe(409);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
    expect(res.headers.get('retry-after')).toBe('30');
    expect(await res.json()).toEqual({
      type: 'https://errors.ecommerce.dev/out-of-stock',
      title: 'Product is out of stock',
      status: 409,
      instance: '/domain',
      code: 'OUT_OF_STOCK',
      correlationId: 'trace-2',
    });
  });

  it('answers 400 with the issues for a Zod error', async () => {
    const res = await postJson(JSON.stringify({ name: 42 }));
    const body = (await res.json()) as { code: string; errors: { path: string }[] };

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.errors[0]?.path).toBe('name');
  });

  it('answers 400 for malformed JSON and 413 for an oversized body', async () => {
    expect((await postJson('{oops')).status).toBe(400);
    expect((await postJson(JSON.stringify({ name: 'x'.repeat(2000) }))).status).toBe(413);
  });

  it('passes an HttpProblem through with its headers', async () => {
    const res = await request('/http-problem');
    expect(res.status).toBe(409);
    expect(res.headers.get('x-extra')).toBe('yes');
  });

  it('hides unexpected errors and domain errors missing from the table behind a 500', async () => {
    for (const path of ['/boom', '/unmapped']) {
      const res = await request(path);
      const body = (await res.json()) as { code: string; title: string };

      expect(res.status).toBe(500);
      expect(body).toMatchObject({ code: 'INTERNAL_ERROR', title: 'Internal server error' });
    }
  });

  it('answers 404 for unknown routes', async () => {
    const res = await request('/nope');
    expect(res.status).toBe(404);
    expect(((await res.json()) as { code: string }).code).toBe('NOT_FOUND');
  });
});

describe('authenticate', () => {
  it('returns the verified claims', async () => {
    const res = await request('/me', { headers: { authorization: 'Bearer good' } });
    expect(await res.json()).toEqual({ userId: 'user-1', role: 'customer' });
  });

  it('answers 401 with WWW-Authenticate when the token is missing or invalid', async () => {
    for (const headers of [{}, { authorization: 'Bearer bad' }]) {
      const res = await request('/me', { headers });
      expect(res.status).toBe(401);
      expect(res.headers.get('www-authenticate')).toBe('Bearer');
    }
  });
});

describe('authenticate when the verifier cannot decide', () => {
  it('answers 503 with Retry-After instead of a 401', async () => {
    const res = await request('/me', { headers: { authorization: 'Bearer unavailable' } });

    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('5');
    expect(res.headers.get('www-authenticate')).toBeNull();
    expect(((await res.json()) as { code: string }).code).toBe('AUTH_UNAVAILABLE');
  });
});

describe('requireRole', () => {
  it('lets a caller with the role through', async () => {
    const res = await request('/admin', { headers: { authorization: 'Bearer admin' } });
    expect(res.status).toBe(200);
  });

  it('answers 403 to an authenticated caller without the role, 401 to an anonymous one', async () => {
    const forbidden = await request('/admin', { headers: { authorization: 'Bearer good' } });
    expect(forbidden.status).toBe(403);
    expect(((await forbidden.json()) as { code: string }).code).toBe('FORBIDDEN');

    expect((await request('/admin')).status).toBe(401);
  });
});

describe('healthRoutes', () => {
  it('reports ready when every check passes', async () => {
    const res = await request('/health/ready');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', checks: [{ name: 'db', status: 'ok' }] });
  });
});
