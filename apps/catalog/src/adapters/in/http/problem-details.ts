import { createProblemDetailsHandler } from '@ecommerce/http';
import type { ErrorRequestHandler } from 'express';

/** Union of the domain errors the API exposes; grows with the domain. */
type KnownDomainError = never;

/** Adding an error to the union above without a status here is a compile error. */
const STATUS_BY_CODE: Record<KnownDomainError['code'], number> = {};

/** Last middleware: catalog's domain errors on top of the shared RFC 9457 handling. */
export const problemDetailsHandler: ErrorRequestHandler = createProblemDetailsHandler({
  statusByCode: STATUS_BY_CODE,
});
