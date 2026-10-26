# Style Guide — E-commerce Microservices

> Project conventions. Every relevant decision here has a matching ADR in [`docs/adr/`](docs/adr/).
> Everything in this repository — code, identifiers, endpoints, docs, ADRs and commit messages — is written in **English**.

---

## 1. Stack

| Area                 | Choice                                    | ADR                                                            |
| -------------------- | ----------------------------------------- | -------------------------------------------------------------- |
| Language / runtime   | TypeScript · Node.js 24 LTS · ESM         | [0002](docs/adr/0002-typescript-node-stack.md)                 |
| HTTP                 | Express 5                                 | [0002](docs/adr/0002-typescript-node-stack.md)                 |
| Validation           | Zod (HTTP, events, env vars)              | [0002](docs/adr/0002-typescript-node-stack.md)                 |
| Relational database  | PostgreSQL + Sequelize                    | [0002](docs/adr/0002-typescript-node-stack.md)                 |
| Logger               | Pino (+ pino-http)                        | [0002](docs/adr/0002-typescript-node-stack.md)                 |
| Tests                | Vitest (+ Testcontainers)                 | [0002](docs/adr/0002-typescript-node-stack.md)                 |
| Lint / format        | oxlint + Prettier                         | [0002](docs/adr/0002-typescript-node-stack.md)                 |
| Monorepo             | pnpm workspaces + Turborepo               | [0003](docs/adr/0003-monorepo-pnpm-turborepo.md)               |
| Service architecture | Hexagonal (Ports & Adapters)              | [0004](docs/adr/0004-hexagonal-architecture.md)                |
| Compute              | Hybrid: containers + AWS Lambda           | [0005](docs/adr/0005-hybrid-compute-localstack-terraform.md)   |
| Local cloud / IaC    | Floci + Terraform                         | [0008](docs/adr/0008-floci-as-local-aws-emulator.md)           |
| Contracts            | REST `/v1`, RFC 9457, CloudEvents, UUIDv7 | [0006](docs/adr/0006-api-and-event-contracts.md)               |
| Shared packages      | `ddd`, `logger`, `http` (mechanics only)  | [0011](docs/adr/0011-shared-packages.md)                       |
| Token verification   | `@ecommerce/auth`, JWKS, 401/403/503      | [0013](docs/adr/0013-access-token-verification-in-services.md) |

---

## 2. TypeScript

- `"type": "module"` in every package (ESM).
- Base `tsconfig` in `packages/tsconfig/` with:
  - `strict: true`
  - `noUncheckedIndexedAccess: true`
  - `exactOptionalPropertyTypes: true`
  - `verbatimModuleSyntax: true` (forces `import type` for types)
- Build: containers compile with `tsc` to `dist/` (dev runs `tsx watch`, see ADR 0009); Lambdas are bundled with `esbuild` into a single file per function.
- `module: NodeNext` ⇒ relative imports must use the `.js` extension (`import { Order } from './order.entity.js'`).
- No explicit `any`; use `unknown` + narrowing (or a Zod schema).
- Prefer `type` for unions/data and `interface` for **ports** (contracts implemented by adapters).
- No TS `enum` — use a literal union + `as const`:
  ```ts
  export const OrderStatus = ['pending', 'confirmed', 'cancelled'] as const;
  export type OrderStatus = (typeof OrderStatus)[number];
  ```

## 3. Naming

| Element               | Convention                       | Example                                           |
| --------------------- | -------------------------------- | ------------------------------------------------- |
| Files                 | `kebab-case` + role suffix       | `create-order.use-case.ts`, `order.repository.ts` |
| Classes / types       | `PascalCase`                     | `Order`, `CreateOrderUseCase`                     |
| Interfaces (ports)    | `PascalCase`, **no** `I` prefix  | `OrderRepository`, `EventPublisher`               |
| Variables / functions | `camelCase`                      | `findById`, `totalAmount`                         |
| Global constants      | `UPPER_SNAKE_CASE`               | `MAX_RETRY_ATTEMPTS`                              |
| Env vars              | `UPPER_SNAKE_CASE`               | `DATABASE_URL`, `ORDERS_QUEUE_URL`                |
| Tables / columns      | `snake_case`, plural tables      | `order_items.unit_price`                          |
| Internal packages     | `@ecommerce/` scope              | `@ecommerce/event-contracts`                      |
| AWS resources         | `ecommerce-<service>-<resource>` | `ecommerce-orders-events-queue`                   |

Standard file suffixes: `.entity`, `.value-object`, `.event`, `.use-case`, `.port`, `.repository`, `.controller`, `.consumer`, `.mapper`, `.schema`, `.error`, `.test`.

## 4. Monorepo layout

```
.
├── api/
│   └── bruno/         # Bruno collection (.bru): one folder per service, local environment
├── apps/              # services running in containers (orders, catalog, inventory, ...)
├── functions/         # AWS Lambdas (event handlers, jobs)
├── packages/          # shared code — ONLY contracts and cross-cutting infrastructure
│   ├── auth/              # access token claims contract + JWKS verifier
│   ├── ddd/               # shared kernel: AggregateRoot, DomainError, Brand (no deps)
│   ├── event-contracts/   # Zod schemas + CloudEvent types
│   ├── http/              # request logging + correlation id, RFC 9457, health, bearer auth
│   ├── logger/            # Pino config with redaction + request context
│   └── tsconfig/          # base tsconfig
├── infra/
│   ├── docker/            # docker-compose (Floci, Postgres, Redis)
│   └── terraform/         # AWS resources
├── docs/
│   ├── adr/
│   └── diagrams/
├── STYLE_GUIDE.md
└── turbo.json / pnpm-workspace.yaml
```

> **Golden rule:** `packages/` never contains business logic. If two services need the same domain logic, the boundary between them is probably wrong. Sharing domain code = distributed monolith.

## 5. Service layout (hexagonal)

```
apps/orders/src/
├── domain/                 # pure: zero framework/infrastructure imports
│   ├── entities/
│   ├── value-objects/
│   ├── events/
│   └── errors/
├── application/
│   ├── use-cases/
│   └── ports/              # interfaces: OrderRepository, EventPublisher, Clock...
├── adapters/
│   ├── in/                 # things that CALL the application
│   │   ├── http/           # Express routes, request schemas, error mapping
│   │   └── messaging/      # SQS consumers
│   └── out/                # things the application CALLS
│       ├── persistence/    # Sequelize models + repositories + mappers
│       ├── messaging/      # SNS/EventBridge publishers, outbox
│       ├── cache/          # Redis
│       └── http-clients/   # calls to other services
├── config.ts               # Zod-validated env
└── main.ts                 # composition root (manual DI)
```

Dependency rules (always pointing **inward**):

- `domain` → imports nothing but itself and the `@ecommerce/ddd` shared kernel (ADR 0011).
- `application` → imports `domain`.
- `adapters` → import `application` and `domain`; never the other way around.
- `main.ts` is the **only** place that instantiates adapters and injects them into use cases.
- Sequelize models **never** leave `adapters/out/persistence`. Repositories convert `Model ↔ Entity` through a mapper.

## 6. Errors

- Domain errors are typed classes in `domain/errors/` extending `DomainError`, with a stable `code` (e.g. `ORDER_ALREADY_CANCELLED`).
- The domain **does not know about HTTP**. The HTTP adapter maps `DomainError → Problem Details`.
- HTTP error responses always follow RFC 9457, `Content-Type: application/problem+json`:
  ```json
  {
    "type": "https://errors.ecommerce.dev/order-already-cancelled",
    "title": "Order already cancelled",
    "status": 409,
    "detail": "Order 01929b7e-... was cancelled at 2026-10-19T12:00:00Z",
    "instance": "/v1/orders/01929b7e-...",
    "code": "ORDER_ALREADY_CANCELLED",
    "correlationId": "..."
  }
  ```
- Unexpected errors → generic `500` with no stack trace leaked; details go to the log.

## 7. REST APIs

- Version in the URL: `/v1/...`.
- Plural, `kebab-case` resources: `/v1/orders`, `/v1/orders/{orderId}/items`, `/v1/product-categories`.
- Non-CRUD actions: verb sub-resource, `POST /v1/orders/{orderId}/cancel`.
- JSON in `camelCase`. Dates in ISO 8601 UTC (`2026-10-19T12:00:00.000Z`). Money as **integer cents** + currency (`{ "amount": 1990, "currency": "BRL" }`).
- Cursor pagination: `?limit=20&cursor=...` → `{ "data": [...], "nextCursor": "..." }`.
- Resource-creating `POST` endpoints accept an `Idempotency-Key` header.
- Headers propagated between services: `x-correlation-id` and `traceparent` (W3C).
- Every service exposes `GET /health/live` and `GET /health/ready`.
- All input is validated with Zod in the `in/http` adapter.

## 8. Events and messages

- **CloudEvents 1.0** envelope (JSON):
  ```json
  {
    "specversion": "1.0",
    "id": "0192a1f3-...",
    "source": "/ecommerce/orders",
    "type": "com.ecommerce.orders.order.placed.v1",
    "time": "2026-10-19T12:00:00.000Z",
    "datacontenttype": "application/json",
    "subject": "0192a1f0-...",
    "correlationid": "...",
    "data": { "orderId": "...", "items": [], "total": { "amount": 1990, "currency": "BRL" } }
  }
  ```
- `type`: `com.ecommerce.<service>.<aggregate>.<past-tense-fact>.v<N>`.
- Events are **past-tense facts** (`placed`, `paid`, `reserved`); commands are imperative (`reserve-stock`) and go to point-to-point queues.
- Incompatible payload change ⇒ new version (`.v2`); publish both versions during migration.
- Zod schemas for every event live in `@ecommerce/event-contracts`.
- Consumers are **idempotent** (dedupe by event `id`) and every queue has a **DLQ**.
- Publishing events from state changes uses the **Outbox Pattern**.

## 9. Database

- One database (or schema) **per service**; no service reads another service's tables.
- Sequelize with `underscored: true`, `timestamps: true` (`created_at`, `updated_at`).
- PK: `id uuid` generated by the application (**UUIDv7**).
- Versioned migrations per service; never `sync()` outside tests.

## 10. Configuration

- 12-factor: all configuration through env vars.
- Each service validates its env with Zod in `config.ts` at startup; invalid env ⇒ process does not start (fail-fast).
- `.env.example` is committed; `.env` is in `.gitignore`.

## 11. Logging

- Pino, JSON, one log entry per line.
- Required fields: `service`, `level`, `msg`, `correlationId`, `traceId` (when available).
- Levels: `error` (action required), `warn` (degradation), `info` (business/lifecycle events), `debug` (development).
- Never log secrets, tokens, passwords or card data.

## 12. Tests

- Vitest. Tests live outside `src/`, in each package's `test/` folder:
  - `test/unit/` mirrors the `src/` tree (`src/domain/entities/user.entity.ts` → `test/unit/domain/entities/user.entity.test.ts`);
  - `test/integration/` holds tests that need real infrastructure.
- `src/` contains production code only.
- **Unit:** domain and use cases with fake ports, no I/O.
- **Integration:** adapters against real Postgres/Redis/Floci via Testcontainers. `pnpm test` runs unit tests only; `pnpm test:integration` runs these (needs Docker).
- Test doubles (in-memory repositories, recording publishers) live in `test/support/`, never in `src/`: the running service only wires real adapters (ADR 0010).
- **Contract:** events validated against `@ecommerce/event-contracts` schemas.
- Test names describe behavior: `it('rejects cancellation of a shipped order')`.

## 13. Lint and formatting

- `oxlint` for linting, `Prettier` for formatting (`singleQuote`, `trailingComma: all`, `printWidth: 100`).
- Lint and format are checked in CI and on pre-commit (lefthook).

## 14. Git

- **Trunk-based**: `main` is always green; short-lived branches `feat/…`, `fix/…`, `chore/…`, `docs/…`.
- Merge through PRs with passing CI; each course module ≈ one PR.
- **Conventional Commits**, scope = service or package:
  ```
  feat(orders): add cancel order endpoint
  fix(inventory): release reservation on payment failure
  docs(adr): add 0007 outbox pattern
  ```
- Enforced with commitlint.

## 15. Documentation

- Architectural decisions → **MADR** ADR in `docs/adr/NNNN-title.md`.
- ADRs are immutable; to change a decision, write a new ADR that **supersedes** the previous one.
- Diagrams in **Mermaid** (C4 and sequence) under `docs/diagrams/` or inside the ADR itself.
