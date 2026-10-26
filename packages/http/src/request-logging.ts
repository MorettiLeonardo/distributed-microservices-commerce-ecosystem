import { randomUUID } from 'node:crypto';
import { type Logger, requestContext } from '@ecommerce/logger';
import type { RequestHandler } from 'express';
import { pinoHttp } from 'pino-http';

const CORRELATION_ID_HEADER = 'x-correlation-id';
/** Incoming ids are reused only when short and plain, so a client cannot forge log content. */
const SAFE_CORRELATION_ID = /^[\w-]{1,64}$/;

/**
 * Mount first: logs each request with a correlation id (reused from `x-correlation-id` when safe,
 * generated otherwise), echoes it in the response, and runs the rest of the chain inside the
 * request context so outgoing messages carry it.
 */
export function requestLogging(logger: Logger): RequestHandler[] {
  return [
    pinoHttp({
      logger,
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
    (req, _res, next) => requestContext.run({ correlationId: String(req.id) }, next),
  ];
}
