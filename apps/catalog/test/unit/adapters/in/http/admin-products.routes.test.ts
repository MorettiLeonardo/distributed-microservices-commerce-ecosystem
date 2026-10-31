import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { testId } from '../../../../support/fakes.js';
import { startTestServer, TOKENS, type TestServer } from '../../../../support/http-server.js';

const NOW = new Date('2026-10-28T12:00:00.000Z');
const asAdmin = { authorization: `Bearer ${TOKENS.admin}` };

describe('admin products routes', () => {
  let server: TestServer;
  let categoryId: string;

  beforeEach(async () => {
    server = await startTestServer({ now: NOW });
    const response = await server.request('/v1/admin/categories', {
      json: { name: 'Books' },
      headers: asAdmin,
    });
    ({ id: categoryId } = (await response.json()) as { id: string });
  });

  afterEach(() => server.close());

  const create = (json: unknown, headers: Record<string, string> = asAdmin) =>
    server.request('/v1/admin/products', { json, headers });

  const get = (id: string, headers: Record<string, string> = asAdmin) =>
    server.request(`/v1/admin/products/${id}`, { headers });

  describe('POST /v1/admin/products', () => {
    it('creates a draft and answers 201 with it and its Location', async () => {
      const response = await create({
        categoryId,
        name: ' Dune ',
        description: 'A desert planet',
        price: { amount: 4990, currency: 'BRL' },
        weightGrams: 450,
      });

      expect(response.status).toBe(201);
      expect(response.headers.get('location')).toBe(`/v1/admin/products/${testId(2)}`);
      expect(await response.json()).toEqual({
        id: testId(2),
        categoryId,
        name: 'Dune',
        description: 'A desert planet',
        price: { amount: 4990, currency: 'BRL' },
        weightGrams: 450,
        images: [],
        status: 'draft',
        createdAt: NOW.toISOString(),
        publishedAt: null,
      });
    });

    it('creates a draft with only the required fields', async () => {
      const response = await create({ categoryId, name: 'Dune' });

      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({ price: null, weightGrams: null });
    });

    it('answers 422 when the category does not exist', async () => {
      const response = await create({ categoryId: testId(99), name: 'Dune' });

      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ code: 'CATEGORY_NOT_FOUND' });
      expect(server.ctx.db.tables.products.size).toBe(0);
    });

    it.each([
      ['a blank name', { name: '   ' }, 'INVALID_PRODUCT_NAME'],
      [
        'a description over 5000 characters',
        { description: 'x'.repeat(5001) },
        'INVALID_PRODUCT_DESCRIPTION',
      ],
      ['a zero price', { price: { amount: 0 } }, 'INVALID_PRICE'],
      ['a fractional price', { price: { amount: 49.9 } }, 'INVALID_MONEY'],
      ['an unknown currency', { price: { amount: 4990, currency: 'USD' } }, 'INVALID_MONEY'],
      ['a weight of zero grams', { weightGrams: 0 }, 'INVALID_WEIGHT'],
    ])('answers 422 for %s', async (_case, fields, code) => {
      const response = await create({ categoryId, name: 'Dune', ...fields });

      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ code });
    });

    it.each([
      // undefined is dropped by JSON.stringify, so the body has no categoryId at all.
      ['a missing category', { categoryId: undefined, name: 'Dune' }],
      ['a category id that is not a UUID', { categoryId: 'books', name: 'Dune' }],
      ['a price that is not an object', { name: 'Dune', price: 4990 }],
      ['a price without an amount', { name: 'Dune', price: { currency: 'BRL' } }],
      ['a weight that is not a number', { name: 'Dune', weightGrams: '450' }],
    ])('answers 400 for %s', async (_case, body) => {
      const response = await create({ categoryId, ...body });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: 'VALIDATION_FAILED' });
    });

    it('answers 403 to a customer, creating nothing', async () => {
      const response = await create(
        { categoryId, name: 'Dune' },
        { authorization: `Bearer ${TOKENS.customer}` },
      );

      expect(response.status).toBe(403);
      expect(server.ctx.db.tables.products.size).toBe(0);
    });
  });

  describe('GET /v1/admin/products/:id', () => {
    it('answers 200 with the product the Location points to', async () => {
      const created = await create({ categoryId, name: 'Dune' });

      const response = await server.request(created.headers.get('location') ?? '', {
        headers: asAdmin,
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(await created.json());
    });

    it('answers 404 for an unknown product', async () => {
      const response = await get(testId(99));

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
    });

    it('answers 400 for an id that is not a UUID', async () => {
      const response = await get('dune');

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: 'VALIDATION_FAILED' });
    });

    it('answers 403 to a customer', async () => {
      const response = await get(testId(99), { authorization: `Bearer ${TOKENS.customer}` });

      expect(response.status).toBe(403);
    });
  });
});
