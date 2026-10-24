# Project Context

> Living document that captures **why** this project exists, **how** we work on it, **what** has been decided and built, and **what comes next**.
> Read this first when resuming work. Last updated: 2026-10-24.

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

The author is an **advanced backend developer**: explanations focus on trade-offs and the reasoning behind patterns, not on basics.

## 2. Working agreements

These rules govern how the project is built (human + AI pair):

1. **Teacher mode.** Claude acts as a teacher. Before implementing anything, it presents the options with trade-offs and **asks for the author's decision**. While implementing, it explains **what** is being done, **how**, and **why**.
2. **Language.** Conversation happens in Portuguese. **Everything written to the repository is in English** — code, comments, docs, ADRs, commit messages.
3. **Commits.** The author commits. Claude never runs `git commit`; it flags good checkpoints and suggests a Conventional Commits message.
4. **Decisions are recorded.** Relevant architectural decisions become ADRs in `docs/adr/` (see ADR 0001).
5. **Didactic bugs are allowed.** Some known problems are deliberately left in place (e.g. dual write) so they can be reproduced and then fixed — "feel the pain before the cure".

## 3. Learning plan

| #   | Module                  | Content                                                                                       | Status         |
| --- | ----------------------- | --------------------------------------------------------------------------------------------- | -------------- |
| 0   | Style guide             | Stack, conventions, layout, API and event standards, commits                                  | ✅ Done        |
| 1   | Domain modeling         | DDD: bounded contexts, aggregates, domain events — started with **Identity** (login/register) | 🟡 In progress |
| 2   | Architecture            | C4 diagrams, ADRs, sync/async map, database per service, Lambda vs container                  | ⬜             |
| 3   | Local infra + IaC       | Docker Compose with Floci, Postgres, Redis; Terraform                                         | ✅ Done        |
| 4   | First service           | Hexagonal architecture, validation, tests, health checks, 12-factor config                    | ✅ Done        |
| 5   | Synchronous HTTP        | REST between services, API Gateway, timeouts, retry with backoff, circuit breaker             | ⬜             |
| 6   | Cache                   | Redis cache-aside, TTL, event-driven invalidation, stampede protection                        | ⬜             |
| 7   | Asynchronous messaging  | SQS, SNS, EventBridge, DLQ, idempotency, Outbox Pattern                                       | 🟡 Partial     |
| 8   | Serverless + S3         | Event-driven Lambdas, presigned URL uploads, reports                                          | 🟡 Partial     |
| 9   | Distributed consistency | Checkout saga: choreography vs orchestration (Step Functions), compensations                  | ⬜             |
| 10  | Observability           | Structured logs, correlation id, OpenTelemetry traces and metrics                             | ⬜             |
| 11  | Tests and quality       | Unit, integration (Testcontainers + Floci), contract tests, CI (GitHub Actions)               | 🟡 Partial     |
| 12  | Portfolio polish        | README with diagrams, ADR index, end-to-end demo script                                       | ⬜             |

### 3.1 Technologies the author wants to learn (placement not decided yet)

These must be used somewhere in the project. **Where** each one fits is still an open question, to be decided when the rest of the e-commerce is modeled. The "candidate fits" are ideas only, not decisions.

| Technology  | Candidate fits (ideas)                                                                       |
| ----------- | -------------------------------------------------------------------------------------------- |
| SNS         | Fan-out of domain events (e.g. `UserRegistered`, `OrderPlaced`) to several subscriber queues |
| SQS         | Per-consumer queues behind SNS, `send-email` command queue, DLQs (module 7)                  |
| API Gateway | Single public entry point in front of the services: routing, JWT validation, throttling      |
| DynamoDB    | Shopping cart (key-value access, TTL for abandoned carts), idempotency keys, rate limiting   |

## 4. Decisions so far

Full detail lives in [`STYLE_GUIDE.md`](../STYLE_GUIDE.md) and [`docs/adr/`](adr/). Summary:

### 4.1 Stack and tooling (ADR 0002, 0003)

| Area                | Choice                                                        | Why (short)                                                              |
| ------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Language / runtime  | TypeScript, Node.js 24 LTS, ESM                               | Same language for containers and Lambdas; strong typing                  |
| TypeScript compiler | TypeScript 7 (native compiler)                                | Installed latest; same `tsc` CLI                                         |
| HTTP framework      | Express 5                                                     | Most widespread; unopinionated, so the architecture is built by hand     |
| Validation          | Zod                                                           | Schema = type; reused for HTTP, events and env config                    |
| Database access     | PostgreSQL + Sequelize                                        | Mature ORM; confined to the persistence adapter                          |
| Logger              | Pino                                                          | Fast JSON logs, OpenTelemetry integration                                |
| Tests               | Vitest (+ Testcontainers later)                               | Native TS/ESM, fast                                                      |
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

| Topic             | Decision                                                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Business failures | **Typed exceptions** extending `DomainError` with a stable `code`                                                                      |
| Entities          | **Encapsulated classes**: private constructor, `X.create()/register()` to create, `X.restore()` to rehydrate from DB (emits no events) |
| Domain events     | **Recorded by the aggregate** (`record()`), pulled by the use case after saving (`pullEvents()`)                                       |
| Time              | `now` **passed as a parameter** — the domain never calls `new Date()`                                                                  |
| IDs               | Generated outside the domain (`IdGenerator` port) and passed in                                                                        |
| Identifiers       | **Branded types** (`UserId`, `SessionId`, `TokenHash`...) so they cannot be mixed up                                                   |
| Use cases         | **Classes with `execute()`**, dependencies injected through the constructor                                                            |
| Atomic writes     | **`UnitOfWork` port** (`unitOfWork.run(repos => ...)`), becomes a DB transaction in the adapter                                        |
| Test doubles      | **In-memory fakes** (state-based tests), not mocks                                                                                     |
| Test location     | Outside `src/`: `test/unit/` mirrors `src/`; `test/integration/` for real infrastructure                                               |
| Shared base code  | `AggregateRoot`/`DomainError` kept inside the service until a 2nd/3rd service needs them ("rule of three")                             |

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

- **HTTP first**, wired to in-memory/log stand-ins **only where infrastructure is needed** (repositories + UoW, login limiter, event publisher, email sender). Clock, UUIDv7, tokens, bcrypt and ES256 JWT are real. `main.ts` refuses to start with `NODE_ENV=production` while stand-ins are wired.
- In-memory adapters live in `src/adapters/out/in-memory/` and are **shared by tests and the running service**; test-only fakes (reversible hasher, sequential ids, controllable clock) stay in `test/support/`.
- New port **`AccessTokenVerifier`**; `JoseAccessTokens` implements issuer + verifier + JWKS. `kid` = RFC 7638 thumbprint.
- **JWT signing key always from env** (`JWT_PRIVATE_KEY`, P-256 private JWK); `pnpm -s --filter @ecommerce/identity keys:generate` prints one.
- **Error → status**: Zod `400 VALIDATION_FAILED`, domain validation `422`, bad credentials/tokens `401` (+ `WWW-Authenticate: Bearer` when the access token is missing/invalid), rate limit `429` + `Retry-After`, lockout `423` + `Retry-After`, disabled `403`, one-time token errors `400`, user not found `404`, anything else `500` without details.
- **Dev runner** `tsx watch`; **HTTP tests** with native `fetch` against `listen(0)`; **bcrypt** native (install script allowed); **Pino + pino-http** with a sanitized `x-correlation-id` and redaction of auth headers/passwords/tokens.
- The stand-ins and the production guard were later replaced by real adapters (4.7).

### 4.7 Identity on real adapters only (ADR 0010)

- **No fakes in `src/`**: test doubles (`InMemoryDatabase`, `InMemoryLoginAttemptLimiter`, recording publisher/sender) live only in `test/support/`.
- **Postgres / Sequelize**: `save` = upsert; `UnitOfWork` = managed transaction passed **explicitly** to transaction-bound repositories; `created_at` owned by the domain (`createdAt: false` in the models). **Umzug** migrations listed explicitly, run by `db:migrate` (never on boot).
- **UNIQUE `users.email`** (author chose to fix the gap now): violation ⇒ `EmailAlreadyRegisteredError` ⇒ `RegisterUser` answers the neutral path.
- **Redis / node-redis**: fixed windows, `INCR` + `EXPIRE NX` in `MULTI`; lock value = its expiry.
- **`@ecommerce/event-contracts`**: Zod schemas + CloudEvents for identity events and the `send-email` command (`com.ecommerce.notification.email.send.v1`); producers validate before sending.
- **SNS** topic `ecommerce-identity-events`; **SQS** `ecommerce-notification-send-email` + DLQ (5 receives); **Lambda** `functions/notification` (esbuild CJS, nodemailer → Mailpit, partial batch responses, never logs tokens).
- **Correlation id** flows HTTP → SNS/SQS → Lambda via `AsyncLocalStorage` (`request-context.ts`).
- **Terraform** (`infra/terraform`) runs in a compose `terraform` service (profile `tools`, `hashicorp/terraform:1.17.0`); `pnpm infra:provision` builds the Lambda and applies.
- **pnpm build scripts**: `ssh2`, `cpu-features`, `protobufjs` (Testcontainers deps) explicitly **denied** — only needed for Docker over SSH.

## 5. What has been built

### 5.1 Repository layout

```
.
├── CLAUDE.md                  # auto-loaded context for Claude Code sessions
├── STYLE_GUIDE.md
├── api/bruno/                 # Bruno collection: identity/{health,auth,users,well-known,errors}
├── docs/
│   ├── PROJECT_CONTEXT.md     # this file
│   ├── adr/0001..0010         # architecture decision records
│   └── domain/identity.md     # Identity domain model + Mermaid diagrams
├── infra/docker/
│   ├── compose.yaml           # identity-db, identity-redis, floci, floci-ui, mailpit, terraform (tools)
│   └── .env.example           # copy to .env (git-ignored)
├── infra/terraform/           # SNS topic, SQS queue + DLQ, notification Lambda (+ IAM, event source)
├── packages/tsconfig/         # @ecommerce/tsconfig — strict base config
├── packages/event-contracts/  # @ecommerce/event-contracts — Zod + CloudEvents (4 tests)
├── functions/notification/    # send-email Lambda: SQS → nodemailer → Mailpit (4 tests)
└── apps/identity/
    ├── .env.example           # copy to .env; needs JWT_PRIVATE_KEY
    ├── scripts/               # generate-jwt-key.ts, migrate.ts
    ├── src/domain/            # entities, value objects, events, errors (pure, no I/O)
    ├── src/application/       # ports, use cases, application errors, token-pair
    ├── src/adapters/in/http/  # Express app, routes, Zod schemas, Problem Details, authenticate
    ├── src/adapters/out/      # persistence/ (Sequelize, Umzug), cache/ (Redis), messaging/ (SNS, SQS),
    │                          # security/ (bcrypt, jose, crypto), system/ (clock, UUIDv7)
    ├── src/config.ts          # Zod-validated env (fail-fast)
    ├── src/logger.ts          # Pino with redaction
    ├── src/request-context.ts # AsyncLocalStorage: correlation id for outgoing messages
    ├── src/main.ts            # composition root
    └── test/
        ├── support/           # test doubles, test context, HTTP server, Testcontainers helpers
        ├── unit/              # 131 tests (domain, use cases, adapters, HTTP, config)
        └── integration/       # 16 tests (Postgres, Redis, SNS/SQS on Floci) via Testcontainers
```

### 5.2 Local infrastructure

| Container        | Image                   | Host port(s)           |
| ---------------- | ----------------------- | ---------------------- |
| `identity-db`    | `postgres:18-alpine`    | 5401                   |
| `identity-redis` | `redis:8.6-alpine`      | 6301                   |
| `floci`          | `floci/floci:2.3.0`     | 4566                   |
| `floci-ui`       | `floci/floci-ui:0.7.0`  | 4500 (web console)     |
| `mailpit`        | `axllent/mailpit:v1.31` | 1025 (SMTP), 8025 (UI) |

Port convention: Postgres `54NN`, Redis `63NN`, service HTTP `30NN`, where `NN` is the service number (`01` = identity ⇒ HTTP on 3001).
Floci needs no account or token. Its state is **persistent** (`floci-data` volume, one JSON file per service under `/app/data`); `pnpm infra:reset` wipes it. Floci UI: http://localhost:4500.

### 5.3 Identity — domain layer

- **Aggregates**: `User` (pending_verification → active → disabled), `Session` (refresh-token family), `OneTimeToken` (email verification / password reset).
- **Value objects**: `Email` (trimmed, lowercased, validated), `Password` (policy + 72-byte limit, redacts itself in logs/JSON).
- **Events**: `UserRegistered`, `UserEmailVerified`, `UserPasswordResetRequested`, `UserPasswordChanged`, plus `UserLockedOut` (emitted by the application layer).

### 5.4 Identity — application layer

- **Ports**: `UserRepository`, `SessionRepository`, `OneTimeTokenRepository`, `UnitOfWork`, `PasswordHasher` (null hash ⇒ dummy comparison for timing safety), `SecureTokenGenerator`, `AccessTokenIssuer`, `EventPublisher`, `EmailSender`, `LoginAttemptLimiter`, `Clock`, `IdGenerator`.
- **Use cases**: `RegisterUser`, `VerifyEmail`, `Login`, `RefreshSession`, `Logout`, `RequestPasswordReset`, `ResetPassword`, `GetCurrentUser`.
- **Tests**: in-memory fakes; the fake database stores **copies** (so a forgotten `save()` fails the test) and the fake `UnitOfWork` **rolls back** on error. Verified with a manual mutation test (removing the revocation `save` makes a test fail).

### 5.5 Identity — adapters (ADR 0009, 0010)

- **HTTP**: all routes from `docs/domain/identity.md` + `/health/live`, `/health/ready` (checks Postgres and Redis) and `/.well-known/jwks.json`.
- **Security / system**: `BcryptPasswordHasher` (dummy hash for unknown users), `JoseAccessTokens`, `CryptoSecureTokenGenerator`, `SystemClock`, `UuidV7IdGenerator`.
- **Persistence**: `SequelizeUserRepository`, `SequelizeSessionRepository`, `SequelizeOneTimeTokenRepository`, `SequelizeUnitOfWork`, migration `0001-create-identity-tables` (UNIQUE email, CHECK constraints, FKs, partial index on active sessions).
- **Cache**: `RedisLoginAttemptLimiter`. **Messaging**: `SnsEventPublisher`, `SqsEmailSender`.
- **Verified end to end by hand** (2026-10-24): register → email in Mailpit (~15 s on Lambda cold start) → verify → login → `/me` with `emailVerified: true`; rows in Postgres, keys + TTLs in Redis, correlation id from the HTTP header in the Lambda log, DLQ empty.
- **Integration tests caught a real bug**: Sequelize's upsert overwrote `created_at`.
- Mutation-tested: audience check (JWT), race handling in `RegisterUser`, `EXPIRE NX` in the limiter.

## 6. Known gaps (deliberate, to be fixed in later modules)

| Problem                                                                                                 | Where                     | Planned fix                              |
| ------------------------------------------------------------------------------------------------------- | ------------------------- | ---------------------------------------- |
| **Dual write**: process can crash between DB commit and event/email publishing                          | `RegisterUser` and others | Transactional Outbox (module 7)          |
| **Concurrent refresh**: two simultaneous refreshes make the second look like reuse and kill the session | `RefreshSession`          | Optimistic locking + short grace period  |
| `RequestPasswordReset` does more work for existing emails (small timing difference)                     | `RequestPasswordReset`    | Revisit once messaging is async          |
| Access tokens cannot be revoked before they expire                                                      | Design (ADR 0007)         | Accepted; mitigated by 15-min lifetime   |
| Rate limit uses `req.ip` without `trust proxy`: behind a gateway every client would share one IP        | `auth.routes.ts`          | Configure `trust proxy` with API Gateway |
| Notification Lambda does not deduplicate by message id: a redelivered command sends a second email      | `functions/notification`  | Idempotency store (DynamoDB candidate)   |
| `pnpm infra:reset` wipes Floci but not the Terraform state file                                         | `infra/terraform`         | Accepted; `infra:provision` recreates    |

## 7. Next steps

**Identity runs on real adapters only** (ADR 0010). Open questions for the author:

- Reproduce and fix the remaining deliberate gaps (dual write → Transactional Outbox; concurrent refresh → optimistic locking).
- Consumer idempotency in the notification Lambda (where DynamoDB could enter, see 3.1).
- Whether every new endpoint must ship with its `.bru` request (style guide rule).

**After Identity:** event-storm the rest of the e-commerce (catalog, cart, orders, inventory, payments, notifications), then follow the learning plan modules.

## 8. Concepts covered so far (study notes)

- **Value Objects** — no identity, immutable, self-validating, equality by value. "Parse, don't validate": a valid `Email` instance is proof of validity. Fixes primitive obsession.
- **Entity vs Value Object** — "do I care _which one_ it is, or only _what_ it is?"
- **Branded types** — nominal typing over primitives at zero runtime cost.
- **`register()` vs `restore()`** — creating an aggregate emits events; loading one must not.
- **Aggregates record their own events** — the event is born with the state change, preparing the ground for the Outbox.
- **Throw-after-mutate** — `Session.rotate()` revokes then throws on reuse; the caller must persist anyway. A real cost of choosing exceptions over Result types.
- **Timing attacks and account enumeration** — equalize work on both paths; return neutral responses.
- **Keep transactions short** — slow work (bcrypt ~250 ms) outside the transaction to avoid pool exhaustion.
- **Events vs commands** — events are past-tense facts broadcast to anyone; commands are intents sent point-to-point.
- **Fakes vs mocks** — state-based tests survive refactoring; fakes must mimic real behavior (copies, rollback).
- **Mutation testing** — break the code on purpose to prove the tests notice.
- **Supply-chain defense** — pnpm blocks dependency install scripts unless explicitly allowed (`allowBuilds`). Seen in practice with `bcrypt` (`node-gyp-build`, prebuilt binaries) and `esbuild` (platform binary check): read the script, then allow.
- **Composition root** — the only place that knows concrete adapters; swapping stand-ins for real adapters changes nothing else.
- **Liveness vs readiness** — live = "restart me if this fails"; ready = "stop sending me traffic", checks dependencies.
- **Problem Details (RFC 9457)** — one error handler, typed code → status map; Zod shape errors (400) vs domain rules (422).
- **Log injection** — never trust an incoming correlation id blindly; validate or regenerate it. Redact auth headers and secrets.
- **JWT hygiene** — check `alg`, `iss`, `aud`, `exp`; `kid` from the key thumbprint allows rotation through the JWKS.
- **Healthchecks that lie** — an SPA fallback answers 200 on any path; probe a real route.
- **Database as the last line of defense** — a check-then-insert race is only closed by a UNIQUE constraint; the adapter translates the violation into a domain-meaningful error.
- **Integration tests find what fakes cannot** — ORM behavior (upsert overwriting `created_at`), real TTLs, real transactions.
- **Fixed windows with `EXPIRE NX`** — set the TTL only when the window opens, or a persistent client keeps it open forever.
- **Partial batch responses** — report only failed SQS records, so successful ones are not reprocessed; DLQ after the redrive limit.
- **Contracts as code** — a shared Zod schema between producer and consumer; the producer validates before sending.
- **Context propagation** — `AsyncLocalStorage` carries the correlation id across async calls, the same mechanism OpenTelemetry uses.
- **Migrations as a separate step** — never on boot, or replicas race each other.

## 9. Environment notes

- Windows 11 + Docker Desktop; shell commands run in Git Bash or PowerShell.
- **pnpm** was installed with `npm install -g pnpm`; its native binary had to be installed manually by running `node install.js` inside `%APPDATA%\npm\node_modules\pnpm` (otherwise Turborepo fails to invoke `pnpm.cmd`).
- Useful commands:

```bash
pnpm infra:up        # start containers and wait until healthy
pnpm infra:down      # stop containers (keep data)
pnpm infra:reset     # stop and delete volumes
pnpm test            # all tests (Turborepo)
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
pnpm dev:identity                         # http://localhost:3001 (builds shared packages first)
```

- Use `pnpm dev:identity`, not `pnpm --filter @ecommerce/identity dev`: the latter does not build `@ecommerce/event-contracts`, so its `dist/` may be missing.
- Emails: Mailpit UI at http://localhost:8025. Lambda logs: `docker logs ecommerce-floci-1`.

- **Manual API testing:** open `api/bruno/` in the Bruno desktop app and select the `local` environment. Login/Refresh store tokens in runtime variables (never in files); one-time tokens from the log go into the `emailToken` secret variable. Bruno CLI was deliberately not added.

- On Windows, stopping `tsx watch` from a background task can leave the child `node` process listening on 3001; stop it by port if needed.
