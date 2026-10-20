# Identity — Domain Model

Bounded context responsible for **authentication**: registering users, verifying emails, issuing and rotating tokens, and recovering passwords. **Authorization** (what a user may do) belongs to each service. See [ADR 0007](../adr/0007-identity-and-authentication.md).

## Ubiquitous language

| Term               | Meaning                                                                |
| ------------------ | ---------------------------------------------------------------------- |
| **User**           | A person with credentials in the platform.                             |
| **Session**        | A token family created at login; holds the current refresh token hash. |
| **Access token**   | Short-lived ES256 JWT used to call services.                           |
| **Refresh token**  | Opaque, single-use secret exchanged for a new token pair.              |
| **One-time token** | Single-use secret for email verification or password reset.            |
| **Lockout**        | Temporary block of an account after repeated login failures.           |

## Aggregates

```mermaid
classDiagram
    class User {
        +UserId id
        +Email email
        +PasswordHash passwordHash
        +UserStatus status
        +Date? emailVerifiedAt
        +register(email, passwordHash)$ User
        +verifyEmail(at)
        +changePassword(newHash)
    }
    class Session {
        +SessionId id
        +UserId userId
        +TokenHash currentTokenHash
        +Date expiresAt
        +Date? revokedAt
        +rotate(presentedHash, newHash)
        +revoke(at)
    }
    class OneTimeToken {
        +OneTimeTokenId id
        +UserId userId
        +Purpose purpose
        +TokenHash tokenHash
        +Date expiresAt
        +Date? consumedAt
        +consume(at)
    }
    User "1" <-- "*" Session : userId
    User "1" <-- "*" OneTimeToken : userId
```

- `UserStatus`: `pending_verification` → `active` → `disabled`.
- `Purpose`: `email_verification` (expires in 24 h) | `password_reset` (expires in 30 min).
- Aggregates reference each other **by id only**.

## Invariants

1. `Email` is trimmed, lowercased and unique.
2. Passwords are 8 characters to 72 UTF-8 bytes; the domain only ever holds a `PasswordHash`.
3. Verifying an already-verified email is a no-op (idempotent).
4. `Session.rotate` with a hash different from `currentTokenHash` ⇒ the session is **revoked** (reuse detection) and the operation fails.
5. A revoked or expired session cannot be rotated.
6. A one-time token can be consumed once, and only before `expiresAt`.
7. Changing the password revokes every session of the user.

## Domain events

All events use the CloudEvents envelope and contain **no secrets**.

| Type                                                      | Emitted when                              | Data                    |
| --------------------------------------------------------- | ----------------------------------------- | ----------------------- |
| `com.ecommerce.identity.user.registered.v1`               | A new user is created                     | `userId`, `email`       |
| `com.ecommerce.identity.user.email-verified.v1`           | The email is verified                     | `userId`                |
| `com.ecommerce.identity.user.password-reset-requested.v1` | A reset is requested for an existing user | `userId`                |
| `com.ecommerce.identity.user.password-changed.v1`         | The password is reset or changed          | `userId`                |
| `com.ecommerce.identity.user.locked-out.v1`               | The failure threshold is reached          | `userId`, `lockedUntil` |

## Commands sent

| Command                                             | Queue                                      | Consumer            |
| --------------------------------------------------- | ------------------------------------------ | ------------------- |
| `send-email` (template + recipient + one-time link) | `ecommerce-notifications-send-email-queue` | Notification Lambda |

## HTTP API

| Method | Path                       | Auth           | Success              |
| ------ | -------------------------- | -------------- | -------------------- |
| `POST` | `/v1/auth/register`        | —              | `202` (neutral)      |
| `POST` | `/v1/auth/login`           | —              | `200` token pair     |
| `POST` | `/v1/auth/refresh`         | refresh token  | `200` new token pair |
| `POST` | `/v1/auth/logout`          | refresh token  | `204`                |
| `POST` | `/v1/auth/verify-email`    | one-time token | `204`                |
| `POST` | `/v1/auth/forgot-password` | —              | `202` (neutral)      |
| `POST` | `/v1/auth/reset-password`  | one-time token | `204`                |
| `GET`  | `/v1/users/me`             | access token   | `200`                |
| `GET`  | `/.well-known/jwks.json`   | —              | `200` JWKS           |

Access token claims: `sub` (user id), `email`, `emailVerified`, `iat`, `exp`, `iss`, `aud`, header `kid`.

## Key flows

### Registration and email verification

```mermaid
sequenceDiagram
    actor C as Client
    participant I as identity
    participant DB as Postgres (identity)
    participant Q as SQS send-email
    participant T as SNS/EventBridge
    participant L as Notification Lambda

    C->>I: POST /v1/auth/register
    alt email not registered
        I->>DB: insert User + OneTimeToken (hash)
        I-)T: user.registered.v1
        I-)Q: send-email (verification link)
    else email already registered
        I-)Q: send-email (account-exists notice)
    end
    I-->>C: 202 Accepted (same body in both cases)
    Q-)L: consume
    L->>L: send email
    C->>I: POST /v1/auth/verify-email {token}
    I->>DB: consume OneTimeToken, mark User verified
    I-)T: user.email-verified.v1
    I-->>C: 204
```

### Refresh token rotation and reuse detection

```mermaid
sequenceDiagram
    actor C as Client
    actor A as Attacker
    participant I as identity

    C->>I: POST /v1/auth/refresh {RT1}
    I-->>C: AT2 + RT2 (RT1 no longer current)
    A->>I: POST /v1/auth/refresh {RT1 stolen}
    I->>I: RT1 ≠ current ⇒ reuse detected
    I->>I: revoke whole session
    I-->>A: 401
    C->>I: POST /v1/auth/refresh {RT2}
    I-->>C: 401 (session revoked, must log in again)
```

### Login with brute-force protection

```mermaid
sequenceDiagram
    actor C as Client
    participant I as identity
    participant R as Redis
    participant DB as Postgres

    C->>I: POST /v1/auth/login
    I->>R: INCR rl:ip:{ip} (TTL 60s)
    alt over IP limit
        I-->>C: 429
    end
    I->>R: GET lock:user:{email}
    alt locked
        I-->>C: 423 Locked
    end
    I->>DB: find user by email
    I->>I: bcrypt compare (dummy hash if user missing)
    alt invalid credentials
        I->>R: INCR fail:user:{email} (TTL 15m)
        opt 5th failure
            I->>R: SET lock:user:{email} (TTL 15m)
            I-)I: publish user.locked-out.v1
        end
        I-->>C: 401 INVALID_CREDENTIALS
    else valid
        I->>R: DEL fail:user:{email}
        I->>DB: create Session
        I-->>C: 200 access + refresh token
    end
```

## Open questions

- **Reliable publishing:** the user insert and the event/command publication must be atomic → Transactional Outbox (to be decided in its own ADR).
- **Email delivery in local env:** LocalStack SES vs MailHog.
