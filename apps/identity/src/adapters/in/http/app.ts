import { randomUUID } from 'node:crypto';
import express, { type Express } from 'express';
import type { JSONWebKeySet } from 'jose';
import { pinoHttp } from 'pino-http';
import type { AccessTokenVerifier } from '../../../application/ports/access-token-verifier.port.js';
import type { GetCurrentUser } from '../../../application/use-cases/get-current-user.use-case.js';
import type { Logger } from '../../../logger.js';
import { requestContext } from '../../../request-context.js';
import { HttpProblem, problemDetailsHandler } from './problem-details.js';
import { type AuthUseCases, authRoutes } from './routes/auth.routes.js';
import { healthRoutes, type ReadinessCheck } from './routes/health.routes.js';
import { usersRoutes } from './routes/users.routes.js';
import { wellKnownRoutes } from './routes/well-known.routes.js';

export type HttpDependencies = {
  useCases: AuthUseCases & { getCurrentUser: GetCurrentUser };
  accessTokenVerifier: AccessTokenVerifier;
  jwks: () => JSONWebKeySet;
  readinessChecks: readonly ReadinessCheck[];
  logger: Logger;
};

const CORRELATION_ID_HEADER = 'x-correlation-id';
/** Incoming ids are reused only when short and plain, so a client cannot forge log content. */
const SAFE_CORRELATION_ID = /^[\w-]{1,64}$/;

/** Builds the Express app without listening, so tests can mount it with fakes. */
export function createApp(deps: HttpDependencies): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(
    pinoHttp({
      logger: deps.logger,
      genReqId: (req, res) => {
        const incoming = req.headers[CORRELATION_ID_HEADER];
        const id =
          typeof incoming === 'string' && SAFE_CORRELATION_ID.test(incoming)
            ? incoming
            : randomUUID();
        res.setHeader(CORRELATION_ID_HEADER, id);
        return id;
      },
      customAttributeKeys: { reqId: 'correlationId' },
      autoLogging: { ignore: (req) => req.url?.startsWith('/health/') ?? false },
    }),
  );
  // Everything after this runs inside the request context, so outgoing messages carry the id.
  app.use((req, _res, next) => requestContext.run({ correlationId: String(req.id) }, next));
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

  app.use(() => {
    throw new HttpProblem(404, 'NOT_FOUND', 'Resource not found');
  });
  app.use(problemDetailsHandler);

  return app;
}
