import { Router } from 'express';
import type { CreateProduct } from '../../../../application/use-cases/create-product.use-case.js';
import type { GetProduct } from '../../../../application/use-cases/get-product.use-case.js';
import type { UpdateProductDetails } from '../../../../application/use-cases/update-product-details.use-case.js';
import {
  CreateProductBody,
  ProductIdParams,
  UpdateProductDetailsBody,
} from '../schemas/product.schema.js';

/**
 * Mounted under `/v1/admin`, behind `requireAdmin`. One endpoint per intent: details, price and
 * lifecycle change separately, each with its own use case and event.
 */
export function adminProductsRoutes(deps: {
  createProduct: CreateProduct;
  getProduct: GetProduct;
  updateProductDetails: UpdateProductDetails;
}): Router {
  const router = Router();

  router.post('/products', async (req, res) => {
    const product = await deps.createProduct.execute(CreateProductBody.parse(req.body));
    res.status(201).location(`/v1/admin/products/${product.id}`).json(product);
  });

  router.get('/products/:id', async (req, res) => {
    const { id } = ProductIdParams.parse(req.params);
    res.json(await deps.getProduct.execute({ productId: id }));
  });

  router.patch('/products/:id', async (req, res) => {
    const { id } = ProductIdParams.parse(req.params);
    const changes = UpdateProductDetailsBody.parse(req.body);
    res.json(await deps.updateProductDetails.execute({ productId: id, ...changes }));
  });

  return router;
}
