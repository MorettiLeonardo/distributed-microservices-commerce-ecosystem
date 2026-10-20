# Style Guide — E-commerce Microservices

> Guia de convenções do projeto. Toda decisão relevante aqui tem um ADR correspondente em [`docs/adr/`](docs/adr/).
> Código, identificadores, endpoints e mensagens de commit em **inglês**; documentação em **português**.

---

## 1. Stack

| Área | Escolha | ADR |
|------|---------|-----|
| Linguagem / runtime | TypeScript · Node.js 24 LTS · ESM | [0002](docs/adr/0002-typescript-node-stack.md) |
| HTTP | Express 5 | [0002](docs/adr/0002-typescript-node-stack.md) |
| Validação | Zod (HTTP, eventos, env vars) | [0002](docs/adr/0002-typescript-node-stack.md) |
| Banco relacional | PostgreSQL + Sequelize | [0002](docs/adr/0002-typescript-node-stack.md) |
| Logger | Pino (+ pino-http) | [0002](docs/adr/0002-typescript-node-stack.md) |
| Testes | Vitest (+ Testcontainers) | [0002](docs/adr/0002-typescript-node-stack.md) |
| Lint / format | oxlint + Prettier | [0002](docs/adr/0002-typescript-node-stack.md) |
| Monorepo | pnpm workspaces + Turborepo | [0003](docs/adr/0003-monorepo-pnpm-turborepo.md) |
| Arquitetura interna | Hexagonal (Ports & Adapters) | [0004](docs/adr/0004-hexagonal-architecture.md) |
| Compute | Híbrido: containers + AWS Lambda | [0005](docs/adr/0005-hybrid-compute-localstack-terraform.md) |
| Cloud local / IaC | LocalStack + Terraform (`tflocal`) | [0005](docs/adr/0005-hybrid-compute-localstack-terraform.md) |
| Contratos | REST `/v1`, RFC 9457, CloudEvents, UUIDv7 | [0006](docs/adr/0006-api-and-event-contracts.md) |

---

## 2. TypeScript

- `"type": "module"` em todos os pacotes (ESM).
- `tsconfig` base em `packages/tsconfig/` com:
  - `strict: true`
  - `noUncheckedIndexedAccess: true`
  - `exactOptionalPropertyTypes: true`
  - `verbatimModuleSyntax: true` (force `import type` para tipos)
- Proibido `any` explícito; use `unknown` + narrowing (ou um schema Zod).
- Prefira `type` para uniões/dados e `interface` para **ports** (contratos implementados por adapters).
- Sem `enum` do TS — use união de literais + `as const`:
  ```ts
  export const OrderStatus = ['pending', 'confirmed', 'cancelled'] as const;
  export type OrderStatus = (typeof OrderStatus)[number];
  ```

## 3. Nomenclatura

| Elemento | Convenção | Exemplo |
|----------|-----------|---------|
| Arquivos | `kebab-case` + sufixo de papel | `create-order.use-case.ts`, `order.repository.ts` |
| Classes / tipos | `PascalCase` | `Order`, `CreateOrderUseCase` |
| Interfaces (ports) | `PascalCase`, **sem** prefixo `I` | `OrderRepository`, `EventPublisher` |
| Variáveis / funções | `camelCase` | `findById`, `totalAmount` |
| Constantes globais | `UPPER_SNAKE_CASE` | `MAX_RETRY_ATTEMPTS` |
| Env vars | `UPPER_SNAKE_CASE` | `DATABASE_URL`, `ORDERS_QUEUE_URL` |
| Tabelas / colunas | `snake_case`, tabelas no plural | `order_items.unit_price` |
| Pacotes internos | escopo `@ecommerce/` | `@ecommerce/event-contracts` |
| Recursos AWS | `ecommerce-<serviço>-<recurso>` | `ecommerce-orders-events-queue` |

Sufixos de arquivo padrão: `.entity`, `.value-object`, `.event`, `.use-case`, `.port`, `.repository`, `.controller`, `.consumer`, `.mapper`, `.schema`, `.error`, `.test`.

## 4. Estrutura do monorepo

```
.
├── apps/              # serviços que rodam em container (orders, catalog, inventory, ...)
├── functions/         # AWS Lambdas (handlers de eventos, jobs)
├── packages/          # código compartilhado — APENAS contratos e infra transversal
│   ├── event-contracts/   # schemas Zod + tipos dos CloudEvents
│   ├── http-problem/      # helpers RFC 9457
│   ├── logger/            # config do Pino + correlation id
│   ├── config/            # loader de env validado com Zod
│   └── tsconfig/          # tsconfig base
├── infra/
│   ├── docker/            # docker-compose (LocalStack, Postgres, Redis)
│   └── terraform/         # recursos AWS
├── docs/
│   ├── adr/
│   └── diagrams/
├── STYLE_GUIDE.md
└── turbo.json / pnpm-workspace.yaml
```

> **Regra de ouro:** `packages/` nunca contém regra de negócio. Se dois serviços precisam da mesma lógica de domínio, provavelmente a fronteira entre eles está errada. Compartilhar domínio = monólito distribuído.

## 5. Estrutura interna de um serviço (hexagonal)

```
apps/orders/src/
├── domain/                 # puro: zero import de framework/infra
│   ├── entities/
│   ├── value-objects/
│   ├── events/
│   └── errors/
├── application/
│   ├── use-cases/
│   └── ports/              # interfaces: OrderRepository, EventPublisher, Clock...
├── adapters/
│   ├── in/                 # quem CHAMA a aplicação
│   │   ├── http/           # rotas Express, schemas de request, mapeamento de erro
│   │   └── messaging/      # consumers SQS
│   └── out/                # quem a aplicação CHAMA
│       ├── persistence/    # models Sequelize + repositórios + mappers
│       ├── messaging/      # publishers SNS/EventBridge, outbox
│       ├── cache/          # Redis
│       └── http-clients/   # chamadas a outros serviços
├── config.ts               # env validada com Zod
└── main.ts                 # composition root (DI manual)
```

Regras de dependência (sempre **para dentro**):

- `domain` → não importa nada além de si mesmo.
- `application` → importa `domain`.
- `adapters` → importam `application` e `domain`; nunca o contrário.
- `main.ts` é o **único** lugar que instancia adapters e injeta nos use cases.
- Models do Sequelize **nunca** saem de `adapters/out/persistence`. O repositório converte `Model ↔ Entity` via mapper.

## 6. Erros

- Erros de domínio são classes tipadas em `domain/errors/` estendendo `DomainError` (com `code` estável, ex.: `ORDER_ALREADY_CANCELLED`).
- O domínio **não conhece HTTP**. O adapter HTTP mapeia `DomainError → Problem Details`.
- Resposta HTTP de erro sempre RFC 9457, `Content-Type: application/problem+json`:
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
- Erros inesperados → `500` genérico, sem vazar stack trace; o detalhe vai pro log.

## 7. APIs REST

- Versão na URL: `/v1/...`.
- Recursos no plural, `kebab-case`: `/v1/orders`, `/v1/orders/{orderId}/items`, `/v1/product-categories`.
- Ações que não são CRUD: sub-recurso com verbo, `POST /v1/orders/{orderId}/cancel`.
- JSON em `camelCase`. Datas em ISO 8601 UTC (`2026-10-19T12:00:00.000Z`). Dinheiro em **centavos inteiros** + moeda (`{ "amount": 1990, "currency": "BRL" }`).
- Paginação por cursor: `?limit=20&cursor=...` → `{ "data": [...], "nextCursor": "..." }`.
- `POST` que cria recurso aceita header `Idempotency-Key`.
- Headers propagados entre serviços: `x-correlation-id` e `traceparent` (W3C).
- Todo serviço expõe `GET /health/live` e `GET /health/ready`.
- Toda entrada validada com Zod no adapter `in/http`.

## 8. Eventos e mensagens

- Envelope **CloudEvents 1.0** (JSON):
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
- `type`: `com.ecommerce.<serviço>.<agregado>.<fato-no-passado>.v<N>`.
- Eventos são **fatos no passado** (`placed`, `paid`, `reserved`); comandos são imperativos (`reserve-stock`) e ficam em filas ponto a ponto.
- Mudança incompatível de payload ⇒ nova versão (`.v2`); publicar as duas versões durante a migração.
- Schemas Zod de todos os eventos vivem em `@ecommerce/event-contracts`.
- Consumers são **idempotentes** (dedupe por `id` do evento) e toda fila tem **DLQ**.
- Publicação de eventos a partir de mudança de estado usa **Outbox Pattern**.

## 9. Banco de dados

- Um banco (database ou schema) **por serviço**; nenhum serviço lê a tabela de outro.
- Sequelize com `underscored: true`, `timestamps: true` (`created_at`, `updated_at`).
- PK: `id uuid` gerado na aplicação (**UUIDv7**).
- Migrations versionadas por serviço; nunca `sync()` fora de testes.

## 10. Configuração

- 12-factor: toda configuração via env var.
- Cada serviço valida sua env com Zod em `config.ts` na inicialização; env inválida ⇒ processo não sobe (fail-fast).
- `.env.example` versionado; `.env` no `.gitignore`.

## 11. Logging

- Pino, JSON, um log por linha.
- Campos obrigatórios: `service`, `level`, `msg`, `correlationId`, `traceId` (quando houver).
- Níveis: `error` (ação necessária), `warn` (degradação), `info` (eventos de negócio/ciclo de vida), `debug` (desenvolvimento).
- Nunca logar segredos, tokens ou dados de cartão.

## 12. Testes

- Vitest. Arquivos `*.test.ts` ao lado do código (unit) e em `test/integration/` (integração).
- **Unit:** domínio e use cases com fakes dos ports, sem I/O.
- **Integração:** adapters contra Postgres/Redis/LocalStack reais via Testcontainers.
- **Contrato:** eventos validados contra os schemas de `@ecommerce/event-contracts`.
- Nome dos testes descreve comportamento: `it('rejects cancellation of a shipped order')`.

## 13. Lint e formatação

- `oxlint` para lint, `Prettier` para formatação (`singleQuote`, `trailingComma: all`, `printWidth: 100`).
- Lint e format checados no CI e em pre-commit (lefthook).

## 14. Git

- **Trunk-based**: `main` sempre verde; branches curtas `feat/…`, `fix/…`, `chore/…`, `docs/…`.
- Merge via PR com CI passando; cada módulo do curso ≈ um PR.
- **Conventional Commits**, escopo = serviço ou pacote:
  ```
  feat(orders): add cancel order endpoint
  fix(inventory): release reservation on payment failure
  docs(adr): add 0007 outbox pattern
  ```
- Validado com commitlint.

## 15. Documentação

- Decisões arquiteturais → ADR no formato **MADR** em `docs/adr/NNNN-titulo.md`.
- ADRs são imutáveis; para mudar uma decisão, crie um novo ADR que **supersede** o anterior.
- Diagramas em **Mermaid** (C4 e sequência) dentro de `docs/diagrams/` ou no próprio ADR.
