import {
  healthRoutes,
  notFoundHandler,
  type ReadinessCheck,
  requestLogging,
} from '@ecommerce/http';
import express, { type Express } from 'express';
import type { JSONWebKeySet } from 'jose';
import type { AccessTokenVerifier } from '../../../application/ports/access-token-verifier.port.js';
import type { GetCurrentUser } from '../../../application/use-cases/get-current-user.use-case.js';
import type { Logger } from '../../../logger.js';
import { problemDetailsHandler } from './problem-details.js';
import { type AuthUseCases, authRoutes } from './routes/auth.routes.js';
import { usersRoutes } from './routes/users.routes.js';
import { wellKnownRoutes } from './routes/well-known.routes.js';

export type HttpDependencies = {
  useCases: AuthUseCases & { getCurrentUser: GetCurrentUser };
  accessTokenVerifier: AccessTokenVerifier;
  jwks: () => JSONWebKeySet;
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
  app.use(wellKnownRoutes(deps.jwks));
  app.use(authRoutes(deps.useCases));
  app.use(
    usersRoutes({
      getCurrentUser: deps.useCases.getCurrentUser,
      accessTokenVerifier: deps.accessTokenVerifier,
    }),
  );

  app.use(notFoundHandler);
  app.use(problemDetailsHandler);

  return app;
}
