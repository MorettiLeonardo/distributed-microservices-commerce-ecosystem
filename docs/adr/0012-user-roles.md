# 0012 — User roles in the access token

- **Status:** accepted
- **Date:** 2026-10-25

## Context and problem

Catalog's admin endpoints (create and publish products, manage stock and coupons) need to know whether the caller is an admin. Identity had no notion of roles: every user was equal and the access token carried no authorization data. Services validate tokens locally through the JWKS (ADR 0007), so whatever decides "admin or not" must be in the token or be fetched on every request.

## Considered options

- **Model:** a `role` on the user, carried as a JWT claim (simple RBAC); fine-grained scopes (`catalog:write`, ...) mapped from roles; a shared admin API key.
- **Granting:** an HTTP endpoint; an operator CLI script.
- **Audit:** a `UserPromotedToAdmin` domain event on SNS; an audit log line.
- **Who can be promoted:** only `active` users; any user not disabled.
- **Tokens issued before the change (no `role`):** treat as `customer`; reject.

## Decision

- **`UserRole = 'customer' | 'admin'`** on the `User` aggregate. Every new user is a `customer`. Stored in `users.role` (`TEXT NOT NULL DEFAULT 'customer'` + `CHECK`), added by migration `0002-add-user-role`; the default turns existing users into customers with no backfill.
- **`role` claim** in the access token. `verify` rejects a token whose `role` is missing or unknown, even when correctly signed. Old tokens stop working; clients refresh and get a token with the claim (at most 15 minutes of impact).
- **Promotion is a domain behavior**, `user.promoteToAdmin()`: only an **active** user (verified email, not disabled) — an unverified address could belong to someone else. Idempotent.
- **No endpoint grants roles.** The `PromoteUserToAdmin` use case is called only by `scripts/promote-user.ts` (`pnpm --filter @ecommerce/identity users:promote <email>`): granting privileges over HTTP is the first target of privilege escalation, and bootstrapping the first admin needs an out-of-band path anyway. The CLI is just another inbound adapter; an admin endpoint could reuse the use case later.
- **No domain event**, following the rule that an event exists only when someone reacts to it (event storming, K8). The script writes an **audit log line** (`audit: true`, action, operating-system user, `userId`, outcome) without the email.
- **Single role, not scopes**: one kind of admin is enough for a single-store e-commerce.

## Consequences

- **+** Services authorize locally from the token, with no call to Identity per request.
- **+** The database rejects unknown roles even from writes that bypass the domain (`CHECK`).
- **+** Privilege changes need shell access to the environment and leave an audit line.
- **−** Promotion takes effect only on the next login or refresh (up to 15 minutes), and **demotion has the same lag** — consistent with the accepted gap that access tokens cannot be revoked early (ADR 0007).
- **−** No demotion command yet (YAGNI); revoking admin today means a manual database change.
- **−** The audit trail lives in logs, not in a durable event stream; an event can be added when a consumer (alerts, audit service) exists.
