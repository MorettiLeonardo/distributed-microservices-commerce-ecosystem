import { authenticate } from '@ecommerce/http';
import { Router } from 'express';
import type { AccessTokenVerifier } from '../../../../application/ports/access-token-verifier.port.js';
import type { GetCurrentUser } from '../../../../application/use-cases/get-current-user.use-case.js';

export function usersRoutes(deps: {
  getCurrentUser: GetCurrentUser;
  accessTokenVerifier: AccessTokenVerifier;
}): Router {
  const router = Router();

  router.get('/v1/users/me', async (req, res) => {
    const { userId } = await authenticate(req, deps.accessTokenVerifier);
    res.json(await deps.getCurrentUser.execute({ userId }));
  });

  return router;
}
