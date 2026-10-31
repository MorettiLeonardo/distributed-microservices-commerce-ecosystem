import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { testId } from '../../../../support/fakes.js';
import { startTestServer, TOKENS, type TestServer } from '../../../../support/http-server.js';

const NOW = new Date('2026-10-28T12:00:00.000Z');
const asAdmin = { authorization: `Bearer ${TOKENS.admin}` };

describe('POST /v1/admin/categories', () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await startTestServer({ now: NOW });
  });

  afterEach(() => server.close());

  const create = (json: unknown, headers: Record<string, string> = asAdmin) =>
    server.request('/v1/admin/categories', { json, headers });

  it('creates a category and answers 201 with it', async () => {
    const response = await create({ name: '  Books ' });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      id: testId(1),
      name: 'Books',
      createdAt: NOW.toISOString(),
    });
    expect(server.ctx.db.tables.categories.size).toBe(1);
  });

  it('answers 409 when the name is taken in any case', async () => {
    await create({ name: 'Books' });

    const response = await create({ name: 'BOOKS' });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'CATEGORY_NAME_TAKEN' });
  });

  it('answers 422 for a name the domain rejects', async () => {
    const response = await create({ name: '   ' });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'INVALID_CATEGORY_NAME' });
  });

  it.each([
    ['a missing name', {}],
    ['a name that is not a string', { name: 42 }],
    ['an abusively long name', { name: 'x'.repeat(1001) }],
  ])('answers 400 for %s', async (_case, body) => {
    const response = await create(body);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  describe('access', () => {
    it.each([
      ['no token', {}],
      ['an invalid token', { authorization: 'Bearer forged' }],
    ])('answers 401 with %s, creating nothing', async (_case, headers) => {
      const response = await create({ name: 'Books' }, headers);

      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toBe('Bearer');
      expect(server.ctx.db.tables.categories.size).toBe(0);
    });

    it('answers 403 to a customer, creating nothing', async () => {
      const response = await create(
        { name: 'Books' },
        { authorization: `Bearer ${TOKENS.customer}` },
      );

      expect(response.status).toBe(403);
      expect(server.ctx.db.tables.categories.size).toBe(0);
    });

    it('answers 503 when tokens cannot be verified', async () => {
      const response = await create(
        { name: 'Books' },
        { authorization: `Bearer ${TOKENS.unverifiable}` },
      );

      expect(response.status).toBe(503);
      expect(response.headers.get('retry-after')).toBe('5');
    });

    it('guards every admin path, even unknown ones, before answering 404', async () => {
      const response = await server.request('/v1/admin/nope');

      expect(response.status).toBe(401);
    });
  });
});
