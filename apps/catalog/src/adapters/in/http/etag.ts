import { HttpProblem } from '@ecommerce/http';
import type { Request } from 'express';

/**
 * Optimistic locking over HTTP (RFC 9110 §13.1.1): the version a use case returns travels as a
 * strong ETag, and a change must send it back in `If-Match`.
 */
export const toETag = (version: number): string => `"${version}"`;

/**
 * The version the client based its change on. No `If-Match`, or `*` (which matches any version),
 * would let a blind write through, so they answer 428. Anything that is not exactly one tag this
 * API issues (a weak tag, a list, garbage) cannot match the current version, so it answers 412.
 */
export function expectedVersion(req: Request): number {
  const ifMatch = req.get('if-match')?.trim();
  if (!ifMatch || ifMatch === '*') {
    throw new HttpProblem(428, 'PRECONDITION_REQUIRED', 'Send the ETag you read as If-Match');
  }
  const version = /^"([1-9]\d{0,9})"$/.exec(ifMatch)?.[1];
  if (version === undefined) {
    throw new HttpProblem(412, 'PRECONDITION_FAILED', 'If-Match does not match the product');
  }
  return Number(version);
}
