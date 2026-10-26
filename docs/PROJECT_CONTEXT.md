# Project Context

> Living document that captures **why** this project exists, **how** we work on it, **what** has been decided and built, and **what comes next**.
> Read this first when resuming work. Last updated: 2026-10-25.

---

## 1. Why this project exists

This is a **learning project first, portfolio project second**.

The goal is to learn, hands-on and end to end, how to design and build a **microservices architecture** with:

- **Asynchronous communication** — queues, events, pub/sub (SQS, SNS, EventBridge)
- **Synchronous communication** — HTTP/REST between services
- **Caching** — Redis
- **AWS services emulated locally** — Floci (S3, Lambda, SQS, SNS, EventBridge, Step Functions, ...)
- Everything from **domain modeling** to **architecture** to **working software**.

The project is **backend only** (no frontend). The domain is an **e-commerce**, chosen because it naturally exercises every pattern above (sagas, events, cache, async workers).

The author is an **advanced backend developer** focused on the **technical side**: explanations focus on trade-offs and the reasoning behind patterns, not on basics. The author does not know e-commerce business rules in depth, so Claude proposes realistic business rules (how the market does it) with a recommended default and frames each choice by its technical consequences; the author still confirms.

The README is written as a product README (no mention of learning).

## 2. Working agreements

These rules govern how the project is built (human + AI pair):

1. **Teacher mode.** Claude acts as a teacher. Before implementing anything, it presents the options with trade-offs and **asks for the author's decision**. While implementing, it explains **what** is being done, **how**, and **why** — the author asked for every step to be explained.
2. **Language.** Conversation happens in Portuguese. **Everything written to the repository is in English** — code, comments, docs, ADRs, commit messages.
3. **Commits.** The author commits. Claude never runs `git commit`; it flags good checkpoints and suggests a Conventional Commits message. (Once, on 2026-10-25, the author explicitly asked Claude to commit; that was a one-off exception, not a rule change.)
4. **Decisions are recorded.** Relevant architectural decisions become ADRs in `docs/adr/` (see ADR 0001). Domain modeling decisions go in `docs/domain/<context>.md`.
5. **Didactic bugs are allowed.** Some known problems are deliberately left in place (e.g. dual write) so they can be reproduced and then fixed — "feel the pain before the cure".
6. **Tests first, then mutation.** New behavior is written test-first (red → green), and key rules are mutation-tested (break the code on purpose, a test must fail).

## 3. Learning plan

| #   | Module                  | Content                                                                           | Status            |
| --- | ----------------------- | --------------------------------------------------------------------------------- | ----------------- |
| 0   | Style guide             | Stack, conventions, layout, API and event standards, commits                      | ✅ Done           |
| 1   | Domain modeling         | DDD: Identity modeled; whole e-commerce event-stormed; Catalog domain built       | 🟡 In progress    |
| 2   | Architecture            | C4 diagrams, ADRs, sync/async map, database per service, Lambda vs container      | 🟡 Partial        |
| 3   | Local infra + IaC       | Docker Compose with Floci, Postgres, Redis; Terraform                             | ✅ Done           |
| 4   | First service           | Hexagonal architecture, validation, tests, health checks, 12-factor config        | ✅ Done           |
| 5   | Synchronous HTTP        | REST between services, API Gateway, timeouts, retry with backoff, circuit breaker | 🟡 Started (JWKS) |
| 6   | Cache                   | Redis cache-aside, TTL, event-driven invalidation, stampede protection            | ⬜                |
| 7   | Asynchronous messaging  | SQS, SNS, EventBridge, DLQ, idempotency, Outbox Pattern                           | 🟡 Partial        |
| 8   | Serverless + S3         | Event-driven Lambdas, presigned URL uploads, reports                              | 🟡 Partial        |
| 9   | Distributed consistency | Checkout saga: choreography vs orchestration (Step Functions), compensations      | ⬜                |
| 10  | Observability           | Structured logs, correlation id, OpenTelemetry traces and metrics                 | ⬜                |
| 11  | Tests and quality       | Unit, integration (Testcontainers + Floci), contract tests, CI (GitHub Actions)   | 🟡 Partial        |
| 12  | Portfolio polish        | README with diagrams, ADR index, end-to-end demo script                           | 🟡 README done    |

### 3.1 Technologies the author wants to learn

| Technology     | Placement                                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| SNS            | Fan-out of domain events (`ShipmentDispatched` → Payments, Inventory, Ordering). Identity already publishes.            |
| SQS            | Per-consumer queues behind SNS, command queues, DLQs. `send-email` already exists.                                      |
| API Gateway    | Single public entry point (routing, JWT validation, throttling). Not placed yet.                                        |
| DynamoDB       | **Decided:** coupon usage limits (conditional writes / `TransactWriteItems`). Candidates: cart (H16), idempotency keys. |
| S3 + Lambda    | **Decided:** product image upload (presigned URL) + image-processor Lambda; sales reports.                              |
| Step Functions | Candidate for the checkout saga orchestration (H10).                                                                    |

## 4. Decisions so far

Full detail lives in [`STYLE_GUIDE.md`](../STYLE_GUIDE.md), [`docs/adr/`](adr/) and [`docs/domain/`](domain/). Summary:

### 4.1 Stack and tooling (ADR 0002, 0003)

| Area                | Choice                                                        | Why (short)                                                              |
| ------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Language / runtime  | TypeScript, Node.js 24 LTS, ESM                               | Same language for containers and Lambdas; strong typing                  |
| TypeScript compiler | TypeScript 7 (native compiler)                                | Installed latest; same `tsc` CLI                                         |
| HTTP framework      | Express 5                                                     | Most widespread; unopinionated, so the architecture is built by hand     |
| Validation          | Zod                                                           | Schema = type; reused for HTTP, events and env config                    |
| Database access     | PostgreSQL + Sequelize                                        | Mature ORM; confined to the persistence adapter                          |
| Logger              | Pino                                                          | Fast JSON logs, OpenTelemetry integration                                |
| Tests               | Vitest (+ Testcontainers)                                     | Native TS/ESM, fast                                                      |
| Lint / format       | oxlint + Prettier                                             | Very fast lint; stable formatter                                         |
| Monorepo            | pnpm workspaces + Turborepo                                   | Shared contracts in one place; cached task graph                         |
| Package manager     | pnpm 12                                                       | Blocks dependency install scripts unless approved (supply-chain defense) |
| Build               | `tsc` → `dist/` for containers; `esbuild` bundles for Lambdas | Explicit and standard; small Lambda bundles                              |
| Module resolution   | `NodeNext` → relative imports end in `.js`                    | Matches Node's real ESM rules                                            |
| Git hooks           | lefthook (pre-commit: lint + format; commit-msg: commitlint)  | Enforces the style guide automatically                                   |
| Commits / branches  | Conventional Commits; trunk-based with short PRs              | Changelog automation; one PR per module                                  |
| Docs                | ADRs (MADR) + Mermaid diagrams                                | Records the "why"; diagrams render on GitHub                             |

### 4.2 Architecture (ADR 0004, 0005, 0008)

- **Hexagonal architecture** (Ports & Adapters) in every service: `domain/` → `application/` (use cases + ports) → `adapters/in|out/` → `main.ts` composition root with **manual DI**. Dependencies always point inward.
- **Hybrid compute**: core services in containers; event-driven workers in AWS Lambda.
- **Floci** for AWS locally (replaced LocalStack, which now requires an account + auth token — ADR 0008), plus the **Floci UI** web console; **Terraform** with an explicit `endpoints` block (no `tflocal`) to provision AWS resources.
- **Total isolation per service**: each service gets **its own Postgres container and its own Redis container** (author's choice, mirrors one RDS per service in production).
- `packages/` holds **only contracts and cross-cutting infrastructure**, never business logic (avoids a distributed monolith).

### 4.3 Contracts (ADR 0006)

- REST versioned in the URL (`/v1/...`), JSON in `camelCase`, money as integer cents + currency.
- HTTP errors follow **RFC 9457 Problem Details** (`application/problem+json`).
- Events use the **CloudEvents 1.0** envelope; type format `com.ecommerce.<service>.<aggregate>.<fact>.v<N>`.
- IDs are **UUIDv7** generated by the application.

### 4.4 Domain modeling style (applies to every service)

| Topic                 | Decision                                                                                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Business failures     | **Typed exceptions** extending `DomainError` with a stable `code`                                                                                                |
| Entities              | **Encapsulated classes**: private constructor, `X.create()/register()` to create, `X.restore()` to rehydrate from DB (emits no events)                           |
| Domain events         | **Recorded by the aggregate** (`record()`), pulled by the use case after saving (`pullEvents()`); recorded **only when something changes**; plain-value payloads |
| Time                  | `now` **passed as a parameter** — the domain never calls `new Date()`                                                                                            |
| IDs                   | Generated outside the domain (`IdGenerator` port) and passed in                                                                                                  |
| Identifiers           | **Branded types** (`UserId`, `ProductId`...) so they cannot be mixed up                                                                                          |
| Use cases             | **Classes with `execute()`**, dependencies injected through the constructor                                                                                      |
| Atomic writes         | **`UnitOfWork` port** (`unitOfWork.run(repos => ...)`), only when several writes must happen together                                                            |
| Test doubles          | **In-memory fakes** (state-based tests), not mocks                                                                                                               |
| Test location         | Outside `src/`: `test/unit/` mirrors `src/`; `test/integration/` for real infrastructure                                                                         |
| Shared base code      | `AggregateRoot`/`DomainError`/`Brand` in the **`@ecommerce/ddd` shared kernel** — the only package the domain may import (ADR 0011)                              |
| Idempotent ops        | Repeating a state change that already happened is a no-op (`verifyEmail`, `publish`, `promoteToAdmin`, `attachImage`)                                            |
| Cross-aggregate rules | Checked in the use case (e.g. "category exists"), backed by the database (FK / UNIQUE)                                                                           |
| Events need consumers | An event exists only if someone reacts to it (`CouponExpired` and `OrderCompleted` were dropped; role promotion emits no event)                                  |

### 4.5 Identity service (ADR 0007, `docs/domain/identity.md`)

- **Own identity service** (not Keycloak/Cognito) — maximum learning.
- **Access token**: JWT signed with **ES256**, 15 min; public keys at `/.well-known/jwks.json` so other services validate tokens **locally** (no sync call per request).
- **Refresh token**: opaque, **rotated on every use**, format `<sessionId>.<secret>`, only its SHA-256 hash stored. Reusing an old token **revokes the whole session** (theft detection). Session expiry is absolute (rotation does not extend it).
- **Passwords**: **bcrypt**, cost 12, max **72 UTF-8 bytes** (bcrypt silently truncates beyond that), min 8 characters.
- **Unverified users can log in**; the token carries `emailVerified`, each service decides what requires it.
- **Anti-enumeration**: `register` and `forgot-password` always answer `202`; the owner of an existing account gets a notice email. Timing is equalized (bcrypt always runs).
- **Secrets never travel in domain events**: emails with one-time links go through a `send-email` **command** on a dedicated SQS queue consumed only by the notification Lambda.
- **Brute force** (Redis): 20 attempts/min per IP; 5 failures in 15 min ⇒ account locked 15 min (unknown emails are locked too, so a lock reveals nothing).
- **TTLs**: one-time token TTLs live in the domain (business rule: verification 24 h, reset 30 min); session and access-token TTLs come from config (operational tuning).
- **Local email**: **Mailpit** (SMTP on 1025, web UI on http://localhost:8025).
- **Outbox**: deferred on purpose — implement the naive dual write first, break it deliberately, then refactor to the Transactional Outbox.

### 4.6 Identity HTTP adapter and dev wiring (ADR 0009)

- New port **`AccessTokenVerifier`**; `JoseAccessTokens` implements issuer + verifier + JWKS. `kid` = RFC 7638 thumbprint.
- **JWT signing key always from env** (`JWT_PRIVATE_KEY`, P-256 private JWK); `pnpm -s --filter @ecommerce/identity keys:generate` prints one.
- **Error → status**: Zod `400 VALIDATION_FAILED`, domain validation `422`, bad credentials/tokens `401` (+ `WWW-Authenticate: Bearer` when the access token is missing/invalid), rate limit `429` + `Retry-After`, lockout `423` + `Retry-After`, disabled `403`, one-time token errors `400`, user not found `404`, anything else `500` without details.
- **Dev runner** `tsx watch`; **HTTP tests** with native `fetch` against `listen(0)`; **bcrypt** native (install script allowed); **Pino + pino-http** with a sanitized `x-correlation-id` and redaction of auth headers/passwords/tokens.

### 4.7 Identity on real adapters only (ADR 0010)

- **No fakes in `src/`**: test doubles live only in `test/support/`.
- **Postgres / Sequelize**: `save` = upsert; `UnitOfWork` = managed transaction passed **explicitly** to transaction-bound repositories; `created_at` owned by the domain. **Umzug** migrations listed explicitly, run by `db:migrate` (never on boot).
- **UNIQUE `users.email`**: violation ⇒ `EmailAlreadyRegisteredError` ⇒ `RegisterUser` answers the neutral path.
- **Redis / node-redis**: fixed windows, `INCR` + `EXPIRE NX` in `MULTI`; lock value = its expiry.
- **`@ecommerce/event-contracts`**: Zod schemas + CloudEvents for identity events and the `send-email` command.
- **SNS** topic `ecommerce-identity-events`; **SQS** `ecommerce-notification-send-email` + DLQ (5 receives); **Lambda** `functions/notification` (esbuild CJS, nodemailer → Mailpit, partial batch responses).
- **Correlation id** flows HTTP → SNS/SQS → Lambda via `AsyncLocalStorage`.
- **Terraform** runs in a compose `terraform` service (profile `tools`); `pnpm infra:provision` builds the Lambda and applies.

### 4.8 Shared packages (ADR 0011)

- Extracted now (author chose not to wait for a third service), **one package per responsibility**: `@ecommerce/ddd` (shared kernel, no deps), `@ecommerce/logger` (`createLogger({ service, level, redact })` — auth headers always redacted — + `requestContext`), `@ecommerce/http` (`requestLogging`, `createProblemDetailsHandler`, `HttpProblem`, `notFoundHandler`, `healthRoutes`, `authenticate`, `requireRole`).
- Only **mechanics** move; services keep their error → status table (compile-time exhaustive), per-error extras, redaction paths and env schema. **Config stays per service.**
- `express` and `zod` are **peer dependencies** of `@ecommerce/http` (single instance ⇒ `instanceof` works).

### 4.9 User roles (ADR 0012)

- `UserRole = 'customer' | 'admin'` on `User`; `role` claim in the access token; tokens without a known role are rejected.
- Migration `0002-add-user-role` (`DEFAULT 'customer'` + `CHECK`).
- **No endpoint grants roles**: `pnpm --filter @ecommerce/identity users:promote <email>` runs `PromoteUserToAdmin` (only **active** users; idempotent) and writes an **audit log line** (no domain event).

### 4.10 Access token verification in other services (ADR 0013)

- **`@ecommerce/auth`**: claims contract (Zod `AccessTokenPayload`) + `JwksAccessTokenVerifier` (jose `createRemoteJWKSet`: lazy fetch, 10 min cache, refetch on unknown `kid`, 30 s cooldown, 5 s timeout).
- Verifier contract: **null ⇒ 401**, **throw ⇒ 503 `AUTH_UNAVAILABLE`** (+ `Retry-After: 5`); token errors are an allow-list, anything unforeseen is a 503. `requireRole` ⇒ **403**.
- Identity's availability is **not** in consumers' readiness (avoids cascading failure).
- **Contract test** in identity: identity-issued token verified through its real JWKS endpoint by `JwksAccessTokenVerifier`.

### 4.11 Event storming (`docs/domain/event-storming.md`)

- **Scope:** single store; signed-in customers only; **simulated PSP** and **simulated carrier** (external fakes with controllable failures); coupons, image upload, reports. Out of scope: returns/refunds after delivery, marketplace, guest checkout, multiple warehouses.
- **Big picture** done; **process level** done for catalog, cart, checkout and delivery; **reporting** will be modeled when it is built. **Design level** (round 3) pending.
- **Key business rules:** stock reserved on `OrderPlaced` (all or nothing); price snapshot on `OrderPlaced`; authorize at checkout, **capture on dispatch** (cancel before dispatch = void, no refund path); PSP answers by webhook, **15 min timeout**, late approval ⇒ void; coupon rejected at redemption cancels the order; shipping quote valid 30 min, bound to cart contents; no fallback price when the carrier is down (`503`); customer cancellation is a **request** the carrier decides; no `OrderCompleted` (final state `delivered`); cart expires after 30 days.
- **Saga order:** stock → coupon → payment (cheapest to undo first, external last).
- **Open technical hotspots (design level):** H9 price source at checkout, H10 choreography vs orchestration, H11 owner of the 15-min timer, H12 reservation expiry, H13 webhook authentication (HMAC), H14 duplicated/out-of-order webhooks, H15 webhook → queue, H16 cart storage, H17 storefront availability, H18 quote cache key, H19 coupon validation source, H21 storefront cache, H22 image processing library, H23 stock storage. (H20 resolved by ADR 0012.)

### 4.12 Catalog (`docs/domain/catalog.md`)

- **Service skeleton:** port 3002, own Postgres (5402) and Redis (6302), shared packages, health checks.
- **Domain:** `Category` (flat) and `Product` aggregates referenced by id; `Product` lifecycle `draft → published ⇄ unpublished`, never deleted; publishing requires price > 0, `weightGrams` and ≥ 1 image (error lists everything missing); ≤ 8 images; `Money` (integer cents, BRL) lives in Catalog's domain.
- **Increment order changed** so the strict image rule never blocks: 5 persistence + admin API → 6 images → 7 storefront + events → 8 cache.

## 5. What has been built

### 5.1 Repository layout

```
.
├── CLAUDE.md                  # auto-loaded context for Claude Code sessions
├── README.md                  # product README (no mention of learning)
├── STYLE_GUIDE.md
├── api/bruno/                 # Bruno collection: identity/{health,auth,users,well-known,errors}, catalog/health
├── docs/
│   ├── PROJECT_CONTEXT.md     # this file
│   ├── adr/0001..0013         # architecture decision records
│   └── domain/                # identity.md, catalog.md, event-storming.md
├── infra/docker/
│   ├── compose.yaml           # identity-db/redis, catalog-db/redis, floci, floci-ui, mailpit, terraform (tools)
│   └── .env.example           # copy to .env (git-ignored)
├── infra/terraform/           # SNS topic, SQS queue + DLQ, notification Lambda (+ IAM, event source)
├── packages/
│   ├── tsconfig/              # @ecommerce/tsconfig — strict base config
│   ├── ddd/                   # shared kernel: AggregateRoot, DomainError, Brand (2 tests)
│   ├── logger/                # Pino with redaction + request context (3 tests)
│   ├── http/                  # request logging, Problem Details, health, authenticate, requireRole (14 tests)
│   ├── auth/                  # claims contract + JWKS verifier (11 tests, real JWKS server)
│   └── event-contracts/       # Zod + CloudEvents (4 tests)
├── functions/notification/    # send-email Lambda: SQS → nodemailer → Mailpit (4 tests)
├── apps/identity/             # 142 unit + 19 integration tests
│   ├── scripts/               # generate-jwt-key.ts, migrate.ts, promote-user.ts
│   └── src/, test/            # hexagonal layout (see STYLE_GUIDE §5)
└── apps/catalog/              # 52 unit tests
    ├── .env.example           # copy to .env
    └── src/                   # config, logger, main, adapters/in/http, adapters/out/{persistence,cache},
                               # domain/{entities,value-objects,events,errors}
```

### 5.2 Local infrastructure

| Container        | Image                   | Host port(s)           |
| ---------------- | ----------------------- | ---------------------- |
| `identity-db`    | `postgres:18-alpine`    | 5401                   |
| `identity-redis` | `redis:8.6-alpine`      | 6301                   |
| `catalog-db`     | `postgres:18-alpine`    | 5402                   |
| `catalog-redis`  | `redis:8.6-alpine`      | 6302                   |
| `floci`          | `floci/floci:2.3.0`     | 4566                   |
| `floci-ui`       | `floci/floci-ui:0.7.0`  | 4500 (web console)     |
| `mailpit`        | `axllent/mailpit:v1.31` | 1025 (SMTP), 8025 (UI) |

Port convention: Postgres `54NN`, Redis `63NN`, service HTTP `30NN`, where `NN` is the service number (`01` = identity, `02` = catalog).
Floci needs no account or token. Its state is **persistent** (`floci-data` volume); `pnpm infra:reset` wipes it. Floci UI: http://localhost:4500.

### 5.3 Identity — domain and application

- **Aggregates**: `User` (pending_verification → active → disabled; `role` customer/admin), `Session` (refresh-token family), `OneTimeToken` (email verification / password reset).
- **Value objects**: `Email`, `Password`.
- **Events**: `UserRegistered`, `UserEmailVerified`, `UserPasswordResetRequested`, `UserPasswordChanged`, plus `UserLockedOut` (application layer).
- **Use cases**: `RegisterUser`, `VerifyEmail`, `Login`, `RefreshSession`, `Logout`, `RequestPasswordReset`, `ResetPassword`, `GetCurrentUser`, `PromoteUserToAdmin`.

### 5.4 Identity — adapters

- **HTTP**: all routes from `docs/domain/identity.md` + health + JWKS. `/v1/users/me` returns `role`.
- **Persistence**: Sequelize repositories + UoW, migrations `0001-create-identity-tables`, `0002-add-user-role`.
- **Cache**: `RedisLoginAttemptLimiter`. **Messaging**: `SnsEventPublisher`, `SqsEmailSender`.
- **CLI**: `users:promote` (inbound adapter calling `PromoteUserToAdmin`).
- Verified end to end by hand (2026-10-24) and the promote script against the local DB (2026-10-25).

### 5.5 Catalog

- Skeleton verified against real infra (2026-10-25): `/health/ready` green with Postgres + Redis, correlation id echoed, JSON logs with `service: catalog`.
- Domain layer done and mutation-tested (publish idempotency, images copy, image limit, weight check). **No persistence or HTTP routes yet.**

## 6. Known gaps (deliberate or accepted)

| Problem                                                                                                              | Where                     | Planned fix                              |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------- | ---------------------------------------- |
| **Dual write**: process can crash between DB commit and event/email publishing                                       | `RegisterUser` and others | Transactional Outbox (module 7)          |
| **Concurrent refresh**: two simultaneous refreshes make the second look like reuse and kill the session              | `RefreshSession`          | Optimistic locking + short grace period  |
| `RequestPasswordReset` does more work for existing emails (small timing difference)                                  | `RequestPasswordReset`    | Revisit once messaging is async          |
| Access tokens cannot be revoked before they expire; role changes (promotion **and** demotion) lag up to 15 min       | Design (ADR 0007, 0012)   | Accepted; mitigated by 15-min lifetime   |
| No command to demote an admin                                                                                        | Identity                  | Add when needed (YAGNI)                  |
| Rate limit uses `req.ip` without `trust proxy`: behind a gateway every client would share one IP                     | `auth.routes.ts`          | Configure `trust proxy` with API Gateway |
| Notification Lambda does not deduplicate by message id: a redelivered command sends a second email                   | `functions/notification`  | Idempotency store (DynamoDB candidate)   |
| `pnpm infra:reset` wipes Floci but not the Terraform state file                                                      | `infra/terraform`         | Accepted; `infra:provision` recreates    |
| `Role` declared twice (identity domain + `@ecommerce/auth` contract); identity does not issue with the shared schema | Identity / auth           | Kept aligned by the contract test        |
| First authenticated request after a cold start pays the JWKS round trip                                              | `@ecommerce/auth`         | Accepted                                 |

## 7. Next steps

Work happens on branch **`feat/catalog`** (not pushed yet). Commits so far: `a29cdee` event storming, `bffa579` shared packages + roles + auth, `26e0c0b` catalog skeleton, `14c042e` catalog domain (increment 4).

Catalog increments (new order):

1. **Increment 5 — persistence + admin API:** application layer (use cases incl. `CreateCategory`, `CreateProduct` checking the category exists, `UpdateProductDetails`, `ChangeProductPrice`, `PublishProduct`, `UnpublishProduct`), Sequelize models/migrations (FK to categories, UNIQUE category name), admin routes protected by `authenticate` + `requireRole('admin')` with `JwksAccessTokenVerifier` wired in catalog (`IDENTITY_JWKS_URL` config), Bruno requests, first manual end-to-end check with a real identity token (promote a user first).
2. **Increment 6 — images:** S3 bucket (Terraform), presigned upload URL, image-processor Lambda (H22), `attachImage`, lifecycle rule.
3. **Increment 7 — storefront + events:** public read routes (cursor pagination, filter by category), catalog events on SNS (`ecommerce-catalog-events`).
4. **Increment 8 — cache:** Redis cache-aside for the storefront, event-driven invalidation, stampede protection (H21).

Later: design level of the event storming (H9–H23), Inventory/Promotions/Cart/Ordering/Payments/Shipping, Outbox, saga.

## 8. Concepts covered so far (study notes)

- **Value Objects** — no identity, immutable, self-validating, equality by value. "Parse, don't validate". Fixes primitive obsession.
- **Entity vs Value Object** — "do I care _which one_ it is, or only _what_ it is?"
- **Branded types** — nominal typing over primitives at zero runtime cost.
- **`register()` vs `restore()`** — creating an aggregate emits events; loading one must not.
- **Aggregates record their own events** — the event is born with the state change, preparing the ground for the Outbox.
- **Aggregate boundaries** — an aggregate is a consistency boundary; things that change for different reasons are separate aggregates referenced by id. Rules spanning aggregates live in the use case.
- **Throw-after-mutate** — `Session.rotate()` revokes then throws on reuse; the caller must persist anyway.
- **Timing attacks and account enumeration** — equalize work on both paths; return neutral responses.
- **Keep transactions short** — slow work (bcrypt ~250 ms) outside the transaction. A single-aggregate save needs no UnitOfWork.
- **Events vs commands** — events are past-tense facts broadcast to anyone; commands are intents sent point-to-point.
- **Events only when something changes / only with consumers** — no-op changes record nothing; an event no one reacts to is noise.
- **Fakes vs mocks** — state-based tests survive refactoring; fakes must mimic real behavior (copies, rollback).
- **Mutation testing** — break the code on purpose to prove the tests notice.
- **Supply-chain defense** — pnpm blocks dependency install scripts unless explicitly allowed (`allowBuilds`).
- **Composition root** — the only place that knows concrete adapters. A CLI script is just another inbound adapter calling a use case.
- **Liveness vs readiness** — live = "restart me"; ready = "stop sending me traffic". Readiness checks only what the **whole** service needs, or a dependency outage cascades.
- **Problem Details (RFC 9457)** — one error handler, typed code → status map; Zod shape errors (400) vs domain rules (422).
- **401 vs 403 vs 503** — unknown caller vs known but not allowed vs "cannot check right now, retry". Never report an infrastructure failure as 401.
- **Log injection** — never trust an incoming correlation id blindly; validate or regenerate it.
- **JWT hygiene** — check `alg`, `iss`, `aud`, `exp`; `kid` from the key thumbprint allows rotation through the JWKS. Reject correctly signed tokens with claims outside the contract.
- **JWKS caching and rotation** — lazy fetch, cache, refetch on unknown `kid`, cooldown so invented `kid`s cannot hammer the issuer.
- **Contract tests** — the real producer against the real consumer's verifier; breaks before production does.
- **Clocks across boundaries** — fake clocks are great until a test crosses into a component on the real clock; both sides must agree.
- **Healthchecks that lie** — an SPA fallback answers 200 on any path; probe a real route.
- **Database as the last line of defense** — UNIQUE and CHECK constraints catch what bypasses the domain; adapters translate violations into domain errors.
- **Migrations** — a separate step, never on boot; `DEFAULT` avoids backfills; always exercise `down`.
- **Integration tests find what fakes cannot** — ORM behavior, real TTLs, real transactions.
- **Fixed windows with `EXPIRE NX`** — set the TTL only when the window opens.
- **Partial batch responses** — report only failed SQS records.
- **Contracts as code** — a shared Zod schema between producer and consumer.
- **Context propagation** — `AsyncLocalStorage` carries the correlation id, the same mechanism OpenTelemetry uses.
- **Shared kernel and the rule of three** — share building blocks, not business concepts; extract mechanics, keep policies in the service.
- **peerDependencies and `instanceof`** — two copies of a library mean two classes; peers guarantee one instance.
- **Structural typing** — a package can accept any `{ verify(token) }` without knowing the service's port.
- **Declaration emit portability** — exported values typed by framework internals need explicit annotations.
- **Privilege escalation** — never grant roles over HTTP; bootstrap admins out of band and audit it.
- **Event storming** — big picture (events, pivotal events, hotspots) → process level (commands, actors, policies, read models, external systems) → design level (aggregates, boundaries).
- **Sagas** — order steps cheapest-to-undo first; compensations undo only what was done, in reverse; timers are events caused by nothing happening.
- **Eventual consistency on reads** — read-side checks are a convenience; the write side is the guarantee.
- **Presigned URLs** — the service signs permission; the client uploads straight to S3.

## 9. Environment notes

- Windows 11 + Docker Desktop; shell commands run in Git Bash or PowerShell.
- **pnpm** was installed with `npm install -g pnpm`; its native binary had to be installed manually by running `node install.js` inside `%APPDATA%\npm\node_modules\pnpm`.
- Useful commands:

```bash
pnpm infra:up        # start containers and wait until healthy
pnpm infra:down      # stop containers (keep data)
pnpm infra:reset     # stop and delete volumes
pnpm test            # all unit tests (Turborepo)
pnpm typecheck
pnpm build
pnpm lint
pnpm format          # / format:check

pnpm test:integration                     # Testcontainers (needs Docker)
pnpm infra:provision                      # build the Lambda + terraform init/apply on Floci
pnpm infra:tf <args>                      # any terraform command (plan, output, destroy...)

# identity (copy apps/identity/.env.example to .env first)
pnpm -s --filter @ecommerce/identity keys:generate >> apps/identity/.env
pnpm --filter @ecommerce/identity db:migrate   # / db:rollback
pnpm -s --filter @ecommerce/identity users:promote <email>
pnpm dev:identity                         # http://localhost:3001

# catalog (copy apps/catalog/.env.example to .env first)
pnpm dev:catalog                          # http://localhost:3002
```

- Use `pnpm dev:<service>`, not `pnpm --filter ... dev`: the latter does not build the shared packages first.
- Emails: Mailpit UI at http://localhost:8025. Lambda logs: `docker logs ecommerce-floci-1`.
- **Manual API testing:** open `api/bruno/` in the Bruno desktop app and select the `local` environment (`identityBaseUrl`, `catalogBaseUrl`).
- On Windows, stopping `tsx watch` from a background task can leave the child `node` process listening on its port; stop it by port if needed.
- On Windows, moving a folder with an open `node_modules` can fail with "Device or resource busy"; to build a lockfile without a workspace package, exclude it temporarily in `pnpm-workspace.yaml` (`'!apps/x'`).
- **lefthook pitfall:** the pre-commit `format` job uses `stage_fixed: true`. With a **partially staged** file in the index, a commit once swept unrelated unstaged changes in. Avoid partially staged files when committing and check `git show --stat` afterwards.
