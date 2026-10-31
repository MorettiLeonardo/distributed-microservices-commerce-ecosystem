import type { AccessTokenClaims } from '@ecommerce/auth';
import {
  healthRoutes,
  notFoundHandler,
  type ReadinessCheck,
  requestLogging,
  type TokenVerifier,
} from '@ecommerce/http';
import express, { type Express } from 'express';
import type { CreateCategory } from '../../../application/use-cases/create-category.use-case.js';
import type { CreateProduct } from '../../../application/use-cases/create-product.use-case.js';
import type { GetProduct } from '../../../application/use-cases/get-product.use-case.js';
import type { Logger } from '../../../logger.js';
import { problemDetailsHandler } from './problem-details.js';
import { requireAdmin } from './require-admin.js';
import { adminCategoriesRoutes } from './routes/admin-categories.routes.js';
import { adminProductsRoutes } from './routes/admin-products.routes.js';

export type HttpDependencies = {
  useCases: {
    createCategory: CreateCategory;
    createProduct: CreateProduct;
    getProduct: GetProduct;
  };
  accessTokenVerifier: TokenVerifier<AccessTokenClaims>;
  readinessChecks: readonly ReadinessCheck[];
  logger: Logger;
};

/** Builds the Express app without listening, so tests can mount it with fakes. */
export function createApp(deps: HttpDependencies): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(requestLogging(deps.logger));
  app.use(express.json({ limit: '10kb' }));

  app.use(healthRoutes(deps.readinessChecks));
  app.use(
    '/v1/admin',
    requireAdmin(deps.accessTokenVerifier),
    adminCategoriesRoutes(deps.useCases),
    adminProductsRoutes(deps.useCases),
  );

  app.use(notFoundHandler);
  app.use(problemDetailsHandler);

  return app;
}
