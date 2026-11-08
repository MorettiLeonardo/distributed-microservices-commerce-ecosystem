import { Router } from 'express';
import type { CreateCategory } from '#src/application/use-cases/create-category.use-case.js';
import { CreateCategoryBody } from '#src/adapters/in/http/schemas/category.schema.js';

/** Mounted under `/v1/admin`, behind `requireAdmin`. */
export function adminCategoriesRoutes(deps: { createCategory: CreateCategory }): Router {
  const router = Router();

  // No Location header yet: there is no route to read a single category from.
  router.post('/categories', async (req, res) => {
    res.status(201).json(await deps.createCategory.execute(CreateCategoryBody.parse(req.body)));
  });

  return router;
}
