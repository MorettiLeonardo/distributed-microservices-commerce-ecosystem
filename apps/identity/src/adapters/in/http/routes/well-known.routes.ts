import { Router } from 'express';
import type { JSONWebKeySet } from 'jose';

/** Public signing keys, so other services verify access tokens locally (ADR 0007). */
export function wellKnownRoutes(jwks: () => JSONWebKeySet): Router {
  const router = Router();

  router.get('/.well-known/jwks.json', (_req, res) => {
    // Consumers cache it; a short max-age still lets a rotated key propagate quickly.
    res.set('Cache-Control', 'public, max-age=300').json(jwks());
  });

  return router;
}
