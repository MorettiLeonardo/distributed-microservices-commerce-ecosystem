import { Router } from 'express';

/** A dependency the service cannot work without (database, cache...). Throws when unhealthy. */
export type ReadinessCheck = {
  name: string;
  check: () => Promise<void>;
};

/**
 * live: the process is up (a failure means "restart me").
 * ready: dependencies answer (a failure means "stop sending me traffic", not "restart me").
 */
export function healthRoutes(readinessChecks: readonly ReadinessCheck[]): Router {
  const router = Router();

  router.get('/health/live', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/health/ready', async (req, res) => {
    const results = await Promise.all(
      readinessChecks.map(async ({ name, check }) => {
        try {
          await check();
          return { name, status: 'ok' as const };
        } catch (error) {
          req.log.warn({ err: error, check: name }, 'readiness check failed');
          return { name, status: 'failing' as const };
        }
      }),
    );
    const ready = results.every((result) => result.status === 'ok');
    res.status(ready ? 200 : 503).json({ status: ready ? 'ok' : 'failing', checks: results });
  });

  return router;
}
