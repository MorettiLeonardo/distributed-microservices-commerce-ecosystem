import { DomainError } from '@ecommerce/ddd';
import type { ErrorRequestHandler, Request } from 'express';
import { z } from 'zod';
import { HttpProblem } from './http-problem.js';

/** Extra fields a service attaches to a specific domain error (e.g. `Retry-After`). */
export type ProblemExtras = { detail?: string; headers?: Record<string, string> };

export type ProblemDetailsOptions<TCode extends string> = {
  /**
   * Status for each domain error code the service knows. Services type it as
   * `Record<KnownError['code'], number>` so a new error without a status fails to compile.
   */
  statusByCode: Record<TCode, number>;
  extras?: (error: DomainError) => ProblemExtras;
};

type Problem = {
  status: number;
  code: string;
  title: string;
  detail?: string;
  headers?: Record<string, string>;
  extensions?: Record<string, unknown>;
};

function isClientError(error: unknown): error is { status: number } {
  if (typeof error !== 'object' || error === null) return false;
  const { status, expose } = error as { status?: unknown; expose?: unknown };
  return typeof status === 'number' && status >= 400 && status < 500 && expose === true;
}

function typeUri(code: string): string {
  return `https://errors.ecommerce.dev/${code.toLowerCase().replaceAll('_', '-')}`;
}

/** Last middleware: turns any error into an RFC 9457 Problem Details response. */
export function createProblemDetailsHandler<TCode extends string>(
  options: ProblemDetailsOptions<TCode>,
): ErrorRequestHandler {
  const statusByCode: Record<string, number> = options.statusByCode;

  function toProblem(error: unknown): Problem {
    if (error instanceof HttpProblem) {
      return {
        status: error.status,
        code: error.code,
        title: error.message,
        headers: error.headers,
      };
    }
    if (error instanceof z.ZodError) {
      return {
        status: 400,
        code: 'VALIDATION_FAILED',
        title: 'Request validation failed',
        extensions: {
          errors: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      };
    }
    const status = error instanceof DomainError ? statusByCode[error.code] : undefined;
    if (error instanceof DomainError && status !== undefined) {
      return { status, code: error.code, title: error.message, ...options.extras?.(error) };
    }
    if (isClientError(error)) {
      // Thrown by express.json(): malformed JSON, payload too large, unsupported charset...
      return {
        status: error.status,
        code: error.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'MALFORMED_REQUEST',
        title: error.status === 413 ? 'Request body is too large' : 'Request body is malformed',
      };
    }
    return { status: 500, code: 'INTERNAL_ERROR', title: 'Internal server error' };
  }

  return (error, req: Request, res, _next) => {
    const problem = toProblem(error);

    if (problem.status >= 500) {
      // Details stay in the log; the client only gets a generic message.
      req.log.error({ err: error }, 'unhandled error');
    }

    res
      .status(problem.status)
      .set(problem.headers ?? {})
      .type('application/problem+json')
      .json({
        type: typeUri(problem.code),
        title: problem.title,
        status: problem.status,
        ...(problem.detail && { detail: problem.detail }),
        instance: req.originalUrl,
        code: problem.code,
        correlationId: req.id,
        ...problem.extensions,
      });
  };
}
