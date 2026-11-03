import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { testId } from '../../../../support/fakes.js';
import { seedImage } from '../../../../support/in-memory-database.js';
import { startTestServer, TOKENS, type TestServer } from '../../../../support/http-server.js';

const NOW = new Date('2026-10-28T12:00:00.000Z');
const asAdmin = { authorization: `Bearer ${TOKENS.admin}` };
const ifMatch = (etag: string) => ({ ...asAdmin, 'if-match': etag });

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

  /** Defaults to the ETag of a freshly created product. */
  const patch = (id: string, json: unknown, headers: Record<string, string> = ifMatch('"1"')) =>
    server.request(`/v1/admin/products/${id}`, { method: 'PATCH', json, headers });

  /** `publish` or `unpublish`; defaults to the ETag of a freshly created product. */
  const action = (
    id: string,
    name: 'publish' | 'unpublish',
    headers: Record<string, string> = ifMatch('"1"'),
  ) => server.request(`/v1/admin/products/${id}/${name}`, { method: 'POST', headers });

  /** A draft with everything publishing requires; the image is seeded (no endpoint until increment 6). */
  const createComplete = async () => {
    const { id } = (await (
      await create({ categoryId, name: 'Dune', price: { amount: 4990 }, weightGrams: 450 })
    ).json()) as { id: string };
    seedImage(server.ctx.db, id);
    return id;
  };

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
      expect(response.headers.get('etag')).toBe('"1"');
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
      expect(response.headers.get('etag')).toBe('"1"');
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

  describe('PATCH /v1/admin/products/:id', () => {
    let productId: string;

    beforeEach(async () => {
      ({ id: productId } = (await (await create({ categoryId, name: 'Dune' })).json()) as {
        id: string;
      });
    });

    it('answers 200 with the product and its new ETag, changing only the given fields', async () => {
      const response = await patch(productId, { description: 'A desert planet', weightGrams: 450 });

      expect(response.status).toBe(200);
      expect(response.headers.get('etag')).toBe('"2"');
      expect(await response.json()).toMatchObject({
        id: productId,
        name: 'Dune',
        description: 'A desert planet',
        weightGrams: 450,
      });
    });

    it('answers 200 to an empty body, changing nothing, not even the ETag', async () => {
      const response = await patch(productId, {});

      expect(response.status).toBe(200);
      expect(response.headers.get('etag')).toBe('"1"');
      expect(await response.json()).toMatchObject({ name: 'Dune', description: '' });
    });

    it('accepts the ETag a GET returned as the If-Match of the next change', async () => {
      await patch(productId, { name: 'Dune Messiah' });
      const etag = (await get(productId)).headers.get('etag') ?? '';

      const response = await patch(
        productId,
        { weightGrams: 450 },
        { ...asAdmin, 'if-match': etag },
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('etag')).toBe('"3"');
    });

    it.each([
      ['no If-Match', {}],
      // `*` matches any version: it would let a blind write through.
      ['If-Match: *', { 'if-match': '*' }],
    ])('answers 428 to %s, changing nothing', async (_case, headers) => {
      const response = await patch(productId, { name: 'Dune Messiah' }, { ...asAdmin, ...headers });

      expect(response.status).toBe(428);
      expect(await response.json()).toMatchObject({ code: 'PRECONDITION_REQUIRED' });
      expect(server.ctx.db.tables.products.get(productId)).toMatchObject({ name: 'Dune' });
    });

    it('answers 412 to a stale If-Match, changing nothing', async () => {
      await patch(productId, { name: 'Dune Messiah' });

      const response = await patch(productId, { weightGrams: 450 });

      expect(response.status).toBe(412);
      expect(await response.json()).toMatchObject({ code: 'PRODUCT_VERSION_CONFLICT' });
      expect(server.ctx.db.tables.products.get(productId)).toMatchObject({
        weightGrams: null,
        version: 2,
      });
    });

    it.each([
      // If-Match compares strongly: a weak tag never matches (RFC 9110 §13.1.1).
      ['a weak tag', 'W/"1"'],
      ['an unquoted version', '1'],
      ['a tag this API never issues', '"dune"'],
      ['a list of tags', '"1", "2"'],
    ])('answers 412 to %s, changing nothing', async (_case, tag) => {
      const response = await patch(productId, { name: 'Dune Messiah' }, ifMatch(tag));

      expect(response.status).toBe(412);
      expect(server.ctx.db.tables.products.get(productId)).toMatchObject({ name: 'Dune' });
    });

    it('answers 404 for an unknown product', async () => {
      const response = await patch(testId(99), { name: 'Dune Messiah' });

      expect(response.status).toBe(404);
    });

    it('answers 422 when the new category does not exist', async () => {
      const response = await patch(productId, { categoryId: testId(99) });

      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ code: 'CATEGORY_NOT_FOUND' });
    });

    it('answers 422 for a value the domain rejects', async () => {
      const response = await patch(productId, { weightGrams: 0 });

      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ code: 'INVALID_WEIGHT' });
    });

    it.each([
      ['a weight set to null', { weightGrams: null }],
      ['a category id that is not a UUID', { categoryId: 'books' }],
      ['a name that is not a string', { name: 42 }],
    ])('answers 400 for %s', async (_case, body) => {
      const response = await patch(productId, body);

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: 'VALIDATION_FAILED' });
    });

    it('answers 403 to a customer, changing nothing', async () => {
      const response = await patch(
        productId,
        { name: 'Hacked' },
        { authorization: `Bearer ${TOKENS.customer}` },
      );

      expect(response.status).toBe(403);
      expect(server.ctx.db.tables.products.get(productId)?.name).toBe('Dune');
    });
  });

  describe('PUT /v1/admin/products/:id/price', () => {
    let productId: string;

    beforeEach(async () => {
      ({ id: productId } = (await (await create({ categoryId, name: 'Dune' })).json()) as {
        id: string;
      });
    });

    const putPrice = (json: unknown, headers: Record<string, string> = ifMatch('"1"')) =>
      server.request(`/v1/admin/products/${productId}/price`, { method: 'PUT', json, headers });

    it('answers 200 with the product and its new ETag', async () => {
      const response = await putPrice({ amount: 4990 });

      expect(response.status).toBe(200);
      expect(response.headers.get('etag')).toBe('"2"');
      expect(await response.json()).toMatchObject({ price: { amount: 4990, currency: 'BRL' } });
    });

    it('answers 422 for a price the domain rejects', async () => {
      const response = await putPrice({ amount: 0 });

      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ code: 'INVALID_PRICE' });
    });

    it.each([
      ['a missing amount', { currency: 'BRL' }],
      ['an amount that is not a number', { amount: '4990' }],
    ])('answers 400 for %s', async (_case, body) => {
      const response = await putPrice(body);

      expect(response.status).toBe(400);
    });

    it('answers 428 without If-Match and 412 with a stale one', async () => {
      expect((await putPrice({ amount: 4990 }, asAdmin)).status).toBe(428);
      expect((await putPrice({ amount: 4990 }, ifMatch('"2"'))).status).toBe(412);
      expect(server.ctx.db.tables.products.get(productId)).toMatchObject({ price: null });
    });

    it('answers 403 to a customer', async () => {
      const response = await putPrice(
        { amount: 1 },
        { authorization: `Bearer ${TOKENS.customer}`, 'if-match': '"1"' },
      );

      expect(response.status).toBe(403);
    });
  });

  describe('POST /v1/admin/products/:id/publish and /unpublish', () => {
    it('publishes a complete draft: 200, new ETag, publishedAt set', async () => {
      const id = await createComplete();

      const response = await action(id, 'publish');

      expect(response.status).toBe(200);
      expect(response.headers.get('etag')).toBe('"2"');
      expect(await response.json()).toMatchObject({
        status: 'published',
        publishedAt: NOW.toISOString(),
      });
    });

    it('answers 409 listing everything an incomplete draft lacks', async () => {
      const { id } = (await (await create({ categoryId, name: 'Dune' })).json()) as { id: string };

      const response = await action(id, 'publish');

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
        code: 'PRODUCT_NOT_PUBLISHABLE',
        missing: ['price', 'weight', 'image'],
      });
    });

    it('unpublishes a published product: 200 and a new ETag', async () => {
      const id = await createComplete();
      await action(id, 'publish');

      const response = await action(id, 'unpublish', ifMatch('"2"'));

      expect(response.status).toBe(200);
      expect(response.headers.get('etag')).toBe('"3"');
      expect(await response.json()).toMatchObject({ status: 'unpublished' });
    });

    it('answers 409 to unpublishing a draft', async () => {
      const id = await createComplete();

      const response = await action(id, 'unpublish');

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: 'PRODUCT_NOT_PUBLISHED' });
    });

    it.each(['publish', 'unpublish'] as const)(
      '%s answers 428 without If-Match, 412 with a stale one and 404 for an unknown product',
      async (name) => {
        const id = await createComplete();

        expect((await action(id, name, asAdmin)).status).toBe(428);
        expect((await action(id, name, ifMatch('"2"'))).status).toBe(412);
        expect((await action(testId(99), name)).status).toBe(404);
        expect(server.ctx.db.tables.products.get(id)).toMatchObject({ status: 'draft' });
      },
    );

    it.each(['publish', 'unpublish'] as const)('%s answers 403 to a customer', async (name) => {
      const id = await createComplete();

      const response = await action(id, name, {
        authorization: `Bearer ${TOKENS.customer}`,
        'if-match': '"1"',
      });

      expect(response.status).toBe(403);
    });
  });
});
