# 0007 — Identity and authentication

- **Status:** accepted
- **Date:** 2026-10-19

## Context and problem

Every service needs to know who the caller is. Authentication must not become a synchronous dependency on every request, must resist common attacks (credential stuffing, brute force, account enumeration, token theft) and must be a learning vehicle for the first asynchronous flow of the system.

## Considered options

- **Identity provider:** own `identity` service; Keycloak; Cognito (LocalStack Pro only)
- **Token signing:** ES256 + JWKS; RS256 + JWKS; HS256 shared secret
- **Password hashing:** Argon2id; bcrypt; scrypt
- **Unverified users:** may log in with a claim; blocked until verified
- **Account enumeration:** neutral responses; `409` on register
- **Delivering one-time secrets to the mailer:** dedicated command queue; secret inside the domain event; mailer fetches it over HTTP
- **Lockout:** temporary lock; progressive delay; per-IP rate limit only

## Decision

1. **Own `identity` service**, built with the standard hexagonal layout.
2. **Access tokens: JWT signed with ES256**, 15-minute lifetime. Public keys exposed at `GET /.well-known/jwks.json` with a `kid` per key so keys can be rotated. Other services validate tokens **locally** using a cached JWKS — no call to `identity` per request.
3. **Refresh tokens: opaque random values with rotation.** Only their SHA-256 hash is stored. Each login creates a `Session` (token family). Presenting a refresh token that is not the family's current one is treated as **reuse/theft** and revokes the whole session.
4. **Passwords hashed with bcrypt**, cost factor 12. Because bcrypt silently truncates input beyond **72 bytes**, passwords are validated to be **at most 72 UTF-8 bytes** (and at least 8 characters).
5. **Unverified users may log in.** The access token carries `emailVerified: boolean`; each service decides what requires verification (e.g. checkout).
6. **Neutral responses against account enumeration.** `register` and `forgot-password` always return `202 Accepted` with the same body. If the email is already registered, its owner receives a notice email instead.
7. **Secrets never travel in domain events.** Domain events (e.g. `user.registered`) are published to subscribers without secrets. Emails containing one-time links are requested through a **`send-email` command on a dedicated SQS queue**, consumed only by the notification Lambda.
8. **Brute-force protection in Redis:**
   - per IP: 20 login attempts per minute;
   - per account: 5 failures within 15 minutes ⇒ account locked for 15 minutes and `user.locked-out` published.
9. **Timing-safe login:** when the email does not exist, the password is still compared against a dummy bcrypt hash so response time does not reveal account existence.

## Consequences

- **+** No synchronous dependency on `identity` for authenticated requests; it can be down without breaking already-issued tokens.
- **+** Stolen refresh tokens are detectable; a database leak does not expose usable tokens.
- **+** Clear separation of events (facts, broadcast) and commands (intent, point-to-point).
- **−** Access tokens cannot be revoked before expiry (mitigated by the 15-minute lifetime).
- **−** Temporary lockout allows an attacker to lock someone else's account for 15 minutes.
- **−** bcrypt's 72-byte limit constrains very long passphrases.
- **−** Building our own IdP is riskier than using a battle-tested one — acceptable for a learning project, not a recommendation for production.
