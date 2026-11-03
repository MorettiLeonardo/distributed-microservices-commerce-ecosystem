# 0016 — Product price and lifecycle endpoints

- **Status:** accepted
- **Date:** 2026-11-02

## Context and problem

Increment 5 still lacked the product changes the domain already supports: `changePrice`, `publish` and `unpublish`. Each records its own event (`ProductPriceChanged`, `ProductPublished`, `ProductUnpublished`) that different consumers will care about (carts and orders react to prices, the storefront cache to visibility). Open questions: how to shape the routes, which status answers an invalid lifecycle transition, how "cannot publish" tells the admin everything that is missing, and how to avoid repeating the optimistic-locking flow (ADR 0015) in every use case.

## Considered options

- **Price:** `PUT /products/{id}/price` (the price as a sub-resource); `POST /products/{id}/price-changes`; a `price` field in the details `PATCH`.
- **Lifecycle:** `POST /products/{id}/publish` and `/unpublish` (actions as sub-resources); `PUT /products/{id}/status` with `{ status }`.
- **Invalid transition** (publish an incomplete product, unpublish a draft): `409 Conflict`; `422 Unprocessable Content`.
- **Missing requirements:** in the `title` text only; as an RFC 9457 extension member `missing: [...]`.
- **Shared flow:** repeat it per use case; a base class; a plain function.

## Decision

- **`PUT /v1/admin/products/{id}/price`** with the Money as the body (`{ amount, currency? }`). `PUT` replaces the whole value and is idempotent; setting the same price records no event, so the ETag stays. Keeping price out of the `PATCH` preserves **one endpoint per intent, one event per endpoint**.
- **`POST /v1/admin/products/{id}/publish`** and **`/unpublish`**, no body. The path names the business intent and maps to one use case each; a generic `status` field would push the state machine into the HTTP adapter. Repeating an action is a no-op, because the domain is idempotent.
- **All three require `If-Match`** and answer `200` with the product and its new `ETag` (ADR 0015).
- **`409` for invalid transitions** (`PRODUCT_NOT_PUBLISHABLE`, `PRODUCT_NOT_PUBLISHED`): the request has no content to be invalid; what refuses it is the resource's current state, which is what `409` means (RFC 9110 §15.5.10). Domain validation of request content stays `422`.
- **`missing: ["price", "weight", "image"]`** travels as an extension member. `@ecommerce/http`'s `ProblemExtras` gained `extensions`, spread **before** the standard members so a service can never override `status`, `type` or `code`. This is mechanics, so it belongs in the shared package (ADR 0011); which error carries what stays in catalog's `extras`.
- **`changeProduct(products, input, change)`**, a plain function in `application/use-cases/`, holds the shared flow: load → `404` → stale version → apply `change` → no event, no save → save with the version. Each use case is a few lines; a base class would add inheritance for no gain.

## Consequences

- **+** Each endpoint, use case and event lines up one to one; consumers can subscribe to exactly the change they care about.
- **+** Admins see every missing requirement in one answer instead of fixing them one by one.
- **+** New product changes (e.g. `attachImage` in increment 6) reuse `changeProduct` and get locking for free.
- **−** Until increment 6 no endpoint attaches images, so publishing over HTTP always answers `409`; tests seed an image behind the use cases (`seedImage`).
- **−** `409` now means two things in catalog: a name taken (`CATEGORY_NAME_TAKEN`) and a state that refuses the action. The `code` tells them apart.
