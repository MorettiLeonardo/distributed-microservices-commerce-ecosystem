# 0011 — Shared packages for cross-cutting code

- **Status:** accepted
- **Date:** 2026-10-25

## Context and problem

Catalog, the second service, needs code identity already has: the Pino logger with redaction, the correlation id (`AsyncLocalStorage`) and its HTTP middleware, RFC 9457 Problem Details, health routes, bearer-token authentication, and the domain building blocks `AggregateRoot`, `DomainError` and `Brand`. The "rule of three" (PROJECT_CONTEXT 4.4) suggested copying until a third service exists; the author chose to extract now, as the style guide's monorepo layout already planned.

Two constraints shaped the extraction:

- `packages/` never holds business logic (ADR 0004, STYLE_GUIDE §4).
- The style guide said `domain` imports nothing but itself.

## Considered options

- **When:** copy now and extract at the third service; extract now.
- **Granularity:** one package per responsibility; a single `@ecommerce/service-kit` with subpath exports.
- **Domain building blocks:** a shared kernel package the domain may import; a copy per service, with the HTTP package recognizing domain errors by duck typing.
- **Configuration:** a `@ecommerce/config` package; keep it in each service.

## Decision

Extract now, one package per responsibility:

| Package             | Contents                                                                                                                                                              | Runtime deps                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `@ecommerce/ddd`    | `AggregateRoot`, `DomainError`, `Brand`                                                                                                                               | none                                |
| `@ecommerce/logger` | `createLogger({ service, level, redact })` (auth headers always redacted, services add their paths), `requestContext`                                                 | `pino`                              |
| `@ecommerce/http`   | `requestLogging` (pino-http + safe correlation id + request context), `createProblemDetailsHandler`, `HttpProblem`, `notFoundHandler`, `healthRoutes`, `authenticate` | `pino-http`; peers `express`, `zod` |

- Only the **mechanics** move. Service-specific parts stay in the service: the error code → status table (still typed as `Record<KnownError['code'], number>`, so a missing status is a compile error), per-error extras such as `Retry-After`, redaction paths for the service's secrets, and the env schema.
- **The domain may import `@ecommerce/ddd`** — a shared kernel of building blocks with no dependencies and no business rules. It is the only package the domain may import.
- `express` and `zod` are **peer dependencies** of `@ecommerce/http`: `instanceof z.ZodError` and `instanceof DomainError` only work with a single instance of each class in the process.
- **Configuration stays in each service**: the generic part is a few lines; the schema is service-specific.
- `authenticate` is generic over the claims type and accepts any `{ verify(token) }`, so identity's `AccessTokenVerifier` port and catalog's JWKS verifier both fit structurally.

## Consequences

- **+** Catalog (and later services) start with the same logging, correlation id, error format and health checks; the log-injection guard and auth-header redaction cannot drift between services.
- **+** Each layer depends only on what it needs: the domain pulls `@ecommerce/ddd`, which brings no framework.
- **+** Verified as a pure refactor: identity's 131 unit and 16 integration tests pass unchanged; the packages have their own tests.
- **−** The abstractions were shaped by one real service; Catalog may reveal the wrong seams and force changes in shared code.
- **−** A change in a shared package affects every service at once; packages must be built before dependents (Turborepo's `^build` handles it).
- **−** Exported values whose types come from Express need explicit annotations in services (declaration emit cannot name Express internals).
