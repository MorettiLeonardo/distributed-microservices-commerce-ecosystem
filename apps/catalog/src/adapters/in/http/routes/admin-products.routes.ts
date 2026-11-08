import { type Response, Router } from 'express';
import type { VersionedProductView } from '#src/application/product.view.js';
import type { ChangeProductPrice } from '#src/application/use-cases/change-product-price.use-case.js';
import type { CreateProduct } from '#src/application/use-cases/create-product.use-case.js';
import type { GetProduct } from '#src/application/use-cases/get-product.use-case.js';
import type { PublishProduct } from '#src/application/use-cases/publish-product.use-case.js';
import type { UnpublishProduct } from '#src/application/use-cases/unpublish-product.use-case.js';
import type { UpdateProductDetails } from '#src/application/use-cases/update-product-details.use-case.js';
import { expectedVersion, toETag } from '#src/adapters/in/http/etag.js';
import {
  ChangeProductPriceBody,
  CreateProductBody,
  ProductIdParams,
  UpdateProductDetailsBody,
} from '#src/adapters/in/http/schemas/product.schema.js';

/**
 * Mounted under `/v1/admin`, behind `requireAdmin`. One endpoint per intent: details, price and
 * lifecycle change separately, each with its own use case and event. Every response carries the
 * product's ETag; every change requires it back as `If-Match`.
 */
export function adminProductsRoutes(deps: {
  createProduct: CreateProduct;
  getProduct: GetProduct;
  updateProductDetails: UpdateProductDetails;
  changeProductPrice: ChangeProductPrice;
  publishProduct: PublishProduct;
  unpublishProduct: UnpublishProduct;
}): Router {
  const router = Router();

  router.post('/products', async (req, res) => {
    const { product, version } = await deps.createProduct.execute(
      CreateProductBody.parse(req.body),
    );
    res
      .status(201)
      .location(`/v1/admin/products/${product.id}`)
      .set('ETag', toETag(version))
      .json(product);
  });

  router.get('/products/:id', async (req, res) => {
    const { id } = ProductIdParams.parse(req.params);
    send(res, await deps.getProduct.execute({ productId: id }));
  });

  router.patch('/products/:id', async (req, res) => {
    const { id } = ProductIdParams.parse(req.params);
    const changes = UpdateProductDetailsBody.parse(req.body);
    send(
      res,
      await deps.updateProductDetails.execute({
        productId: id,
        expectedVersion: expectedVersion(req),
        ...changes,
      }),
    );
  });

  router.put('/products/:id/price', async (req, res) => {
    const { id } = ProductIdParams.parse(req.params);
    const price = ChangeProductPriceBody.parse(req.body);
    send(
      res,
      await deps.changeProductPrice.execute({
        productId: id,
        expectedVersion: expectedVersion(req),
        price,
      }),
    );
  });

  // Actions, not resources: the path names the business intent. No body.
  for (const [action, useCase] of [
    ['publish', deps.publishProduct],
    ['unpublish', deps.unpublishProduct],
  ] as const) {
    router.post(`/products/:id/${action}`, async (req, res) => {
      const { id } = ProductIdParams.parse(req.params);
      send(res, await useCase.execute({ productId: id, expectedVersion: expectedVersion(req) }));
    });
  }

  return router;
}

const send = (res: Response, { product, version }: VersionedProductView): void => {
  res.set('ETag', toETag(version)).json(product);
};
