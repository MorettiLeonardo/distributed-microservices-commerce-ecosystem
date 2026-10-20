# 0002 — TypeScript/Node.js stack

- **Status:** accepted
- **Date:** 2026-10-19

## Context and problem

We need a single stack for both containerized services and Lambdas, with strong typing and a mature ecosystem for AWS, messaging and caching.

## Considered options

- **Language:** TypeScript/Node.js, Go, Java/Kotlin + Spring, C#/.NET
- **HTTP:** Express, Fastify, NestJS, Hono
- **Data access:** Sequelize, Drizzle, Prisma, Kysely, TypeORM
- **Validation:** Zod, Valibot, class-validator
- **Lint/format:** oxlint + Prettier, Biome, ESLint + Prettier
- **Tests:** Vitest, Jest, node:test
- **Logger:** Pino, Winston, Powertools Logger

## Decision

| Area | Choice |
|------|--------|
| Runtime | Node.js 24 LTS, ESM, TypeScript `strict` |
| HTTP | Express 5 |
| Validation | Zod |
| Data | PostgreSQL + Sequelize |
| Lint/format | oxlint + Prettier |
| Tests | Vitest |
| Logger | Pino |

### Rationale

- **TypeScript/Node:** same language in containers and Lambda; native async I/O; first-class AWS SDK v3.
- **Express 5:** the most widespread framework; v5 natively handles rejections from `async` handlers. Express's lack of opinions is intentional: we build the hexagonal architecture by hand.
- **Zod:** schema = type (`z.infer`), reusable across HTTP, events and config.
- **Sequelize:** mature ORM, widely used in industry. Confined to the persistence adapter.
- **oxlint + Prettier:** extremely fast linting; Prettier as a stable formatter.
- **Vitest:** native TS/ESM, fast, Jest-compatible API.
- **Pino:** fastest JSON logger in the ecosystem, OpenTelemetry integration.

## Consequences

- **+** One language across the whole system; shared packages are easy.
- **−** Express has no built-in validation/serialization → standardize our own middlewares.
- **−** Sequelize typing is more verbose; requires explicit `Model ↔ Entity` mappers (which reinforces decoupling).
