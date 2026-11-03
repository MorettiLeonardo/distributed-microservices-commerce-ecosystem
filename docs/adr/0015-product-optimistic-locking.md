# 0015 — Optimistic locking for products (ETag / If-Match)

- **Status:** accepted
- **Date:** 2026-11-02

## Context and problem

`PATCH /v1/admin/products/{id}` loads the aggregate, changes it in memory and saves it whole (upsert). Two admins who read the same product and change it one after the other produce a **lost update**: the second save overwrites the first one's change with the stale values it read. The same race exists between two requests running at the same time. Price and lifecycle changes (next in increment 5) and the image-processor Lambda (increment 6) will write to the same row, so the problem grows with every writer.

## Considered options

- **Concurrency control:** none (last write wins); pessimistic locking (`SELECT ... FOR UPDATE` for the whole use case); optimistic locking with a version column.
- **Where the version lives:** a field of the `Product` aggregate; beside it (`VersionedProduct = { product, version }`) in the repository port.
- **How the version is checked:** read, compare, then write; the `UPDATE`'s own `WHERE version = :expected`; Sequelize's built-in `version: true`.
- **How it travels over HTTP:** a `version` field in the body; `ETag` + `If-Match` headers.
- **Missing `If-Match`:** apply the change unconditionally; `428 Precondition Required`.
- **Stale `If-Match`:** `409 Conflict`; `412 Precondition Failed`.

## Decision

- **Optimistic locking.** Conflicts between admins are rare, a request must not hold a row lock across I/O (category lookup), and the version also protects read-then-write across requests, which no database lock can do.
- **The version travels beside the aggregate**, not inside it: it is a concurrency concept, not a business one. `findById` returns `{ product, version }`; `save(product, expectedVersion)` takes `null` to insert (version 1) or the version read, and returns the new one. Use cases return `VersionedProductView`.
- **The check is the `UPDATE`'s `WHERE`**, written by hand in the repository: `UPDATE products SET ..., version = :expected + 1 WHERE id = :id AND version = :expected`; zero rows ⇒ `ProductVersionConflictError`. Under `READ COMMITTED` a concurrent update waits for the first one's row lock, re-evaluates its `WHERE` on the committed row and matches nothing, so exactly one wins. A separate `SELECT` first would leave a window between check and write. Sequelize's `version: true` only works on instance saves and hides the mechanism this project wants visible.
- **The use case also checks up front** (`found.version !== expectedVersion`): a stale request is refused even when it changes nothing or carries invalid values, instead of answering `200` or `422` based on data the caller never saw. Mutation testing showed this check is observable only in those cases, so they have tests.
- **No change, no write:** the use case skips the save when the aggregate recorded no event, so the version, and the client's ETag, stay valid.
- **HTTP:** every product response carries a **strong `ETag`** (`"<version>"`); `PATCH` requires **`If-Match`**. Missing or `*` (which matches any version, so it would allow a blind write) ⇒ **`428 PRECONDITION_REQUIRED`**. Stale ⇒ **`412 PRODUCT_VERSION_CONFLICT`**. Anything that is not exactly one tag this API issues (weak tag, list, garbage) cannot match ⇒ **`412 PRECONDITION_FAILED`**. Parsing lives in the HTTP adapter (`etag.ts`); the application only sees `expectedVersion: number`.
- **Migration `0003-add-product-version`** adds `version INTEGER NOT NULL DEFAULT 1`, so existing rows need no backfill; `0002` is not edited because it was already applied.

## Consequences

- **+** Lost updates are impossible, both across requests (stale read) and between concurrent ones (the `WHERE`), proven against real Postgres by an integration test that races two saves.
- **+** Standard HTTP semantics: clients and proxies already understand `ETag`, `If-Match`, `412` and `428`; a `GET` with `If-None-Match` gets a `304` from Express for free.
- **+** The domain stays unaware of persistence concerns.
- **−** Clients must keep the ETag and send it back; a missing header is an error, not a convenience.
- **−** Every future product writer (price, publish, image-processor Lambda) must carry a version. The Lambda has no client ETag: it will read the current version and retry on conflict.
- **−** The version counts saves of the whole aggregate: a price change invalidates an ETag held for a details change, even though they touch different fields. Accepted; conflicts are rare and the fix is a re-read.
