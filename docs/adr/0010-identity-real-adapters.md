# 0010 — Identity runs on real adapters only

- **Status:** accepted (supersedes the stand-ins of 0009)
- **Date:** 2026-10-24

## Context and problem

ADR 0009 wired identity to in-memory/log stand-ins for Postgres, Redis and messaging. The author decided the running service must have **no fakes**: every port backed by real infrastructure (local equivalents of the production services). Test doubles remain, but only in `test/`.

## Considered options

- **Migrations:** Umzug (programmatic, TS/ESM); sequelize-cli.
- **Redis client:** node-redis (official); ioredis (maintenance mode).
- **Concurrent registration gap:** reproduce first, fix later; fix now with a UNIQUE index.
- **Contracts:** shared `@ecommerce/event-contracts`; schema duplicated on each side.
- **Command format:** CloudEvents envelope; plain JSON.
- **Notification Lambda:** now; later (module 8).
- **AWS resources:** Terraform now; init script.
- **Running Terraform:** Docker image in the compose network; installed on the host.

## Decision

- **Postgres via Sequelize**: models + mappers + repositories in `adapters/out/persistence`; `save` is an upsert; `UnitOfWork` = managed transaction passed **explicitly** to transaction-bound repositories. `created_at` belongs to the domain (Sequelize manages only `updated_at`). Migrations with **Umzug**, listed explicitly, run as a **separate step** (`db:migrate`), never on boot.
- **UNIQUE index on `users.email`** fixes the concurrent-registration gap now: the repository maps the violation to `EmailAlreadyRegisteredError`, and `RegisterUser` answers the neutral path (notice email). The in-memory test double mimics the index.
- **Redis via node-redis**: fixed windows with `INCR` + `EXPIRE NX` in `MULTI` (TTL set only when a window opens); the lock value is its expiry, for `Retry-After`.
- **`@ecommerce/event-contracts`**: Zod schemas for identity events and the `send-email` command, CloudEvents envelope for both (command type `com.ecommerce.notification.email.send.v1`). The producer validates commands before sending.
- **SNS publisher** (topic `ecommerce-identity-events`, `type` message attribute for filter policies) and **SQS email sender** (queue `ecommerce-notification-send-email` + DLQ, 5 receives).
- **Correlation id** reaches messages through `AsyncLocalStorage` (`request-context.ts`), set by the HTTP adapter. Reserved for cross-cutting metadata.
- **Notification Lambda** (`functions/notification`): esbuild CJS bundle, nodemailer → Mailpit, partial batch responses (`ReportBatchItemFailures`), never logs tokens.
- **Terraform** in `infra/terraform`, run by a `terraform` compose service (profile `tools`, `hashicorp/terraform:1.17.0`) inside the compose network; `pnpm infra:provision` builds the Lambda and applies.
- The production guard of ADR 0009 is removed.

## Consequences

- **+** The full flow runs for real: HTTP → Postgres/Redis → SNS/SQS → Lambda → email in Mailpit, with the correlation id end to end.
- **+** Integration tests (Testcontainers: Postgres, Redis, Floci) caught a real bug the fakes could not: Sequelize's upsert overwrote `created_at`.
- **+** Same Terraform code could target a real account (minus the endpoints block).
- **−** More moving parts to start locally (`infra:up`, `infra:provision`, `db:migrate`, `dev:identity`).
- **−** The Lambda does not deduplicate by message id yet: a redelivered command sends a second email (needs an idempotency store).
- **−** `AsyncLocalStorage` is implicit state; misuse (business data in it) would hide dependencies.
- **−** `pnpm infra:reset` wipes Floci but not the Terraform state file; the next `apply` recreates what is missing.
