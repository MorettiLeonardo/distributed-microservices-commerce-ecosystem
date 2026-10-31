# 0014 — Catalog admin API

- **Status:** accepted
- **Date:** 2026-10-28

## Context and problem

Catalog increment 5 adds the first write path of the service: admins create categories (and, next, products) over HTTP with an identity-issued token (ADR 0012, 0013). Open questions: in which order to build it, where admin routes live and how they are protected, where category name uniqueness is enforced and how, and what a creation answers.

## Considered options

- **Build order:** vertical slice per aggregate (Category end to end, then Product); horizontal layers (all use cases, then all persistence, then all routes).
- **Route path:** a separate `/v1/admin/...` prefix; the same `/v1/categories` resource with access decided per HTTP method.
- **Token check:** per handler (`authenticate()` in every route, as identity does); one middleware on the admin prefix. Verifier as an application port; only in the HTTP adapter.
- **Middleware location:** in catalog; a generic `authorize(verifier, ...roles)` in `@ecommerce/http`.
- **Case-insensitive uniqueness:** UNIQUE index on `lower(name)`; a `citext` column; a nondeterministic ICU collation.
- **Duplicate detection:** check with a lookup before saving **and** rely on the UNIQUE index; the UNIQUE index alone.
- **Creation response:** `201` with the resource and no `Location`; `201` with a `Location` that still answers `404`; add `GET` by id now.

## Decision

- **Vertical slices.** Category goes through use case → persistence → route → manual check first; it sets the patterns Product follows. Integration problems show up while little code depends on them.
- **`/v1/admin` prefix** for admin routes; the storefront will get its own public routes (`GET /v1/categories`). Admin and storefront answers diverge (drafts are admin-only), and a prefix lets a gateway or cache apply policy per prefix.
- **One gate middleware**, `requireAdmin(verifier)`, mounted with `app.use('/v1/admin', requireAdmin(...), routes)`: it composes `authenticate` + `requireRole('admin')` from `@ecommerce/http`. A new admin route is protected without anyone remembering it, and unknown admin paths answer `401`, not `404`, to callers who are not admins. It lives **in catalog** until a second service needs it (rule of three, ADR 0011).
- **Token verification only in the HTTP adapter.** Routes take the generic `TokenVerifier<AccessTokenClaims>` from `@ecommerce/http`; `main.ts` injects `JwksAccessTokenVerifier`. No use case needs the caller yet, so no application port. Config: `IDENTITY_JWKS_URL` (required), `JWT_ISSUER` / `JWT_AUDIENCE` (same defaults as identity). The variable is named after the issuer, like `Identity:Url` in Microsoft's eShop; the dependency is on a published JWKS, not on identity's code or database.
- **Names are unique ignoring case; accents count** (`Books` = `BOOKS`, `Eletrônicos` ≠ `Eletronicos`). Enforced **only** by `CREATE UNIQUE INDEX categories_name_unique ON categories (lower(name))`; the name is stored as typed. The repository's `save` translates a violation of that index, **matched by index name** (the pg error's `constraint`), into `CategoryNameTakenError` → `409`. Matching by `error.fields` would be fragile: on an expression index Postgres reports the key as `lower(name)`, not `name`.
- **No lookup before saving.** Mutation testing showed the lookup was an equivalent mutant: removing it changes nothing observable, since the index raises the same error, and only the index covers two creations racing each other. (Identity's `RegisterUser` keeps its lookup because its duplicate path behaves differently: it sends a notice email.)
- **`201` with the view** `{ id, name, createdAt }` and **no `Location`** until a read route exists. Use cases return plain views, so inbound adapters never touch aggregates.
- **Error statuses:** `INVALID_CATEGORY_NAME` `422`, `CATEGORY_NAME_TAKEN` `409`; Zod shape errors `400`; token `401`, role `403`, JWKS unreachable `503` (ADR 0013).
- `CategoryCreated` is recorded by the aggregate but **not published** until catalog events get a consumer (increment 7).

## Consequences

- **+** One place guards every admin route; the access tests cover the prefix, not each handler.
- **+** The uniqueness rule has a single source of truth, proven against real Postgres by integration tests (both mutants — no translation, index without `lower` — fail them).
- **+** Replacing identity with another issuer (Cognito, Keycloak) is configuration only.
- **−** `lower()` follows the database locale: with `en_US.utf8` (the `postgres:18-alpine` default) `AÇÃO` and `ação` collide, with the `C` locale only ASCII is folded and they would not. The in-memory fake (`toLowerCase`) always folds, so only the integration test guards this.
- **−** Any future lookup by name must use `lower(name)` to hit the index.
- **−** The middleware does not expose the claims to handlers; when a use case needs the caller (e.g. auditing), it must start passing them on (`res.locals`).
