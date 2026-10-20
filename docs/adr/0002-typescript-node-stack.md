# 0002 — Stack TypeScript/Node.js

- **Status:** accepted
- **Data:** 2026-10-19

## Contexto e problema

Precisamos de uma stack única para serviços em container e para Lambdas, com boa tipagem e ecossistema maduro para AWS, mensageria e cache.

## Opções consideradas

- **Linguagem:** TypeScript/Node.js, Go, Java/Kotlin + Spring, C#/.NET
- **HTTP:** Express, Fastify, NestJS, Hono
- **Acesso a dados:** Sequelize, Drizzle, Prisma, Kysely, TypeORM
- **Validação:** Zod, Valibot, class-validator
- **Lint/format:** oxlint + Prettier, Biome, ESLint + Prettier
- **Testes:** Vitest, Jest, node:test
- **Logger:** Pino, Winston, Powertools Logger

## Decisão

| Área | Escolha |
|------|---------|
| Runtime | Node.js 24 LTS, ESM, TypeScript `strict` |
| HTTP | Express 5 |
| Validação | Zod |
| Dados | PostgreSQL + Sequelize |
| Lint/format | oxlint + Prettier |
| Testes | Vitest |
| Logger | Pino |

### Justificativa

- **TypeScript/Node:** mesma linguagem em containers e Lambda; I/O assíncrono nativo; SDK v3 da AWS de primeira classe.
- **Express 5:** o framework mais difundido; a v5 trata rejeições de handlers `async` nativamente. A falta de opinião do Express é proposital: montamos a arquitetura hexagonal à mão.
- **Zod:** schema = tipo (`z.infer`), reutilizável em HTTP, eventos e config.
- **Sequelize:** ORM maduro e muito presente no mercado. Fica confinado ao adapter de persistência.
- **oxlint + Prettier:** lint extremamente rápido; Prettier como formatador estável.
- **Vitest:** TS/ESM nativos, rápido, API compatível com Jest.
- **Pino:** logger JSON mais rápido do ecossistema, integração com OpenTelemetry.

## Consequências

- **+** Uma linguagem só em todo o sistema; pacotes compartilhados fáceis.
- **−** Express não tem validação/serialização nativas → padronizar middlewares próprios.
- **−** Tipagem do Sequelize é mais verbosa; exige mappers explícitos `Model ↔ Entity` (o que reforça o desacoplamento).
