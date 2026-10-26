import {
  healthRoutes,
  notFoundHandler,
  type ReadinessCheck,
  requestLogging,
} from '@ecommerce/http';
import express, { type Express } from 'express';
import type { Logger } from '../../../logger.js';
import { problemDetailsHandler } from './problem-details.js';

export type HttpDependencies = {
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

  app.use(notFoundHandler);
  app.use(problemDetailsHandler);

  return app;
}
