import { AsyncLocalStorage } from 'node:async_hooks';

type RequestContext = {
  correlationId: string;
};

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * Per-request metadata that follows the async call chain, so outbound adapters can stamp
 * messages with the correlation id without threading it through every use case. Reserved for
 * cross-cutting metadata (tracing), never for business data or dependencies.
 */
export const requestContext = {
  run<T>(context: RequestContext, fn: () => T): T {
    return storage.run(context, fn);
  },

  correlationId(): string | undefined {
    return storage.getStore()?.correlationId;
  },
};
