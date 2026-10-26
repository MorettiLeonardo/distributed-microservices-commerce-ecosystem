# 0013 — Access token verification in other services

- **Status:** accepted
- **Date:** 2026-10-25

## Context and problem

Catalog is the first service that must authenticate callers with tokens issued by identity, and authorize admins by the `role` claim (ADR 0012). ADR 0007 already chose local verification through identity's JWKS (no call to identity per request). Open questions: where the verifier and the claims format live, how keys are cached and rotated, what happens when identity is unreachable, and how to tell "not authenticated" from "not allowed".

## Considered options

- **Location:** a new `@ecommerce/auth` package; an adapter inside each service; inside `@ecommerce/http`.
- **JWKS unreachable:** report it as `503`; let it fall through as `401`.
- **End-to-end proof now:** tests against a real JWKS server (manual check with identity when the first protected route exists); a temporary `/v1/admin/ping` route.

## Decision

- **`@ecommerce/auth`** holds the **claims contract** (`AccessTokenPayload` Zod schema: `sub`, `email`, `emailVerified`, `role`) and **`JwksAccessTokenVerifier`**, built on jose's `createRemoteJWKSet` with its defaults: keys fetched lazily, cached (10 min), refetched on an unknown `kid` (key rotation) with a 30 s cooldown (an attacker inventing `kid`s cannot make us hammer identity), 5 s timeout.
- **Verifier contract:** `verify` returns **null for an invalid token** and **throws `AuthUnavailableError` when it cannot decide**. Token errors are an **allow-list** of jose errors; anything unforeseen counts as unavailable, so it becomes a retryable `503`, never a `401` that would make a client throw away a good token.
- **`@ecommerce/http`:** `authenticate` maps a throwing verifier to **`503 AUTH_UNAVAILABLE`** with `Retry-After: 5`, and an invalid/missing token to `401` + `WWW-Authenticate: Bearer` as before. It knows nothing about JWKS: the null-or-throw contract is generic (identity's local verifier never throws). New **`requireRole(claims, ...roles)`** ⇒ **`403 FORBIDDEN`** (known caller, not allowed) — distinct from `401` (unknown caller).
- **Identity's availability is not part of a consumer's readiness.** Otherwise an identity outage would pull the whole consumer out of the load balancer, including public routes that need no token (cascading failure). Readiness checks only what the entire service cannot work without.
- **No throwaway route.** The verifier is tested against a real local JWKS server (rotation, caching, 500, timeout, nothing listening), and a **contract test** in identity verifies identity-issued tokens through identity's real JWKS endpoint with `JwksAccessTokenVerifier`. Catalog wires the verifier with its first protected route.

## Consequences

- **+** One claims contract for issuer and consumers; a breaking change in identity fails identity's contract test first.
- **+** Key rotation needs no coordination: consumers discover new keys by `kid`.
- **+** Infrastructure failures are reported honestly (`503`, retryable) instead of logging users out.
- **−** `Role` is declared twice: in identity's domain (`UserRole`) and in the contract. The domain may import only `@ecommerce/ddd`, so the contract test is what keeps them aligned.
- **−** Identity does not use the shared payload schema for issuing yet; it signs with its own adapter.
- **−** With lazy fetching, the first authenticated request after a cold start pays the JWKS round trip.
