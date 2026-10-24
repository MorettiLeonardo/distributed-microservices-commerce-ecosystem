import type { ErrorRequestHandler, Request } from 'express';
import { z } from 'zod';
import {
  AccountLockedError,
  type InvalidCredentialsError,
  type InvalidOneTimeTokenError,
  type InvalidRefreshTokenError,
  TooManyLoginAttemptsError,
} from '../../../application/errors/authentication.error.js';
import type { UserNotFoundError } from '../../../application/errors/user-not-found.error.js';
import type { InvalidEmailError } from '../../../domain/errors/email.error.js';
import type {
  OneTimeTokenAlreadyConsumedError,
  OneTimeTokenExpiredError,
} from '../../../domain/errors/one-time-token.error.js';
import type {
  PasswordTooLongError,
  PasswordTooShortError,
} from '../../../domain/errors/password.error.js';
import type {
  RefreshTokenReuseDetectedError,
  SessionExpiredError,
  SessionRevokedError,
} from '../../../domain/errors/session.error.js';
import type { UserDisabledError } from '../../../domain/errors/user.error.js';
import { DomainError } from '../../../domain/shared/domain-error.js';

/** An error raised by the HTTP layer itself (authentication, routing), already in HTTP terms. */
export class HttpProblem extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    title: string,
    readonly headers: Record<string, string> = {},
  ) {
    super(title);
  }
}

type KnownDomainError =
  | InvalidEmailError
  | PasswordTooShortError
  | PasswordTooLongError
  | InvalidCredentialsError
  | TooManyLoginAttemptsError
  | AccountLockedError
  | UserDisabledError
  | InvalidRefreshTokenError
  | SessionRevokedError
  | SessionExpiredError
  | RefreshTokenReuseDetectedError
  | InvalidOneTimeTokenError
  | OneTimeTokenExpiredError
  | OneTimeTokenAlreadyConsumedError
  | UserNotFoundError;

/** Adding an error to the union above without a status here is a compile error. */
const STATUS_BY_CODE: Record<KnownDomainError['code'], number> = {
  INVALID_EMAIL: 422,
  PASSWORD_TOO_SHORT: 422,
  PASSWORD_TOO_LONG: 422,
  INVALID_CREDENTIALS: 401,
  TOO_MANY_LOGIN_ATTEMPTS: 429,
  ACCOUNT_LOCKED: 423,
  USER_DISABLED: 403,
  INVALID_REFRESH_TOKEN: 401,
  SESSION_REVOKED: 401,
  SESSION_EXPIRED: 401,
  REFRESH_TOKEN_REUSE_DETECTED: 401,
  INVALID_ONE_TIME_TOKEN: 400,
  ONE_TIME_TOKEN_EXPIRED: 400,
  ONE_TIME_TOKEN_ALREADY_CONSUMED: 400,
  USER_NOT_FOUND: 404,
};

/** Matches the per-IP window of the login attempt limiter (ADR 0007). */
const LOGIN_RATE_LIMIT_WINDOW_SECONDS = 60;

type Problem = {
  status: number;
  code: string;
  title: string;
  detail?: string;
  headers?: Record<string, string>;
  extensions?: Record<string, unknown>;
};

function toProblem(error: unknown): Problem {
  if (error instanceof HttpProblem) {
    return { status: error.status, code: error.code, title: error.message, headers: error.headers };
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
  if (error instanceof DomainError && error.code in STATUS_BY_CODE) {
    return {
      status: STATUS_BY_CODE[error.code as KnownDomainError['code']],
      code: error.code,
      title: error.message,
      ...domainErrorExtras(error),
    };
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

function domainErrorExtras(error: DomainError): Pick<Problem, 'detail' | 'headers'> {
  if (error instanceof AccountLockedError) {
    return {
      detail: `Locked until ${error.lockedUntil.toISOString()}`,
      headers: { 'Retry-After': error.lockedUntil.toUTCString() },
    };
  }
  if (error instanceof TooManyLoginAttemptsError) {
    return { headers: { 'Retry-After': String(LOGIN_RATE_LIMIT_WINDOW_SECONDS) } };
  }
  return {};
}

function isClientError(error: unknown): error is { status: number } {
  if (typeof error !== 'object' || error === null) return false;
  const { status, expose } = error as { status?: unknown; expose?: unknown };
  return typeof status === 'number' && status >= 400 && status < 500 && expose === true;
}

function typeUri(code: string): string {
  return `https://errors.ecommerce.dev/${code.toLowerCase().replaceAll('_', '-')}`;
}

/** Last middleware: turns any error into an RFC 9457 Problem Details response. */
export const problemDetailsHandler: ErrorRequestHandler = (error, req: Request, res, _next) => {
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
