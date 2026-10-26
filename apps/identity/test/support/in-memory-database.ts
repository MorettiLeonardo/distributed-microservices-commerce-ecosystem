import { EmailAlreadyRegisteredError } from '../../src/application/errors/email-already-registered.error.js';
import type { OneTimeTokenRepository } from '../../src/application/ports/one-time-token.repository.port.js';
import type { SessionRepository } from '../../src/application/ports/session.repository.port.js';
import type { Repositories, UnitOfWork } from '../../src/application/ports/unit-of-work.port.js';
import type { UserRepository } from '../../src/application/ports/user.repository.port.js';
import {
  OneTimeToken,
  type OneTimeTokenProps,
  type OneTimeTokenPurpose,
} from '../../src/domain/entities/one-time-token.entity.js';
import { Session, type SessionProps } from '../../src/domain/entities/session.entity.js';
import { User, type UserProps } from '../../src/domain/entities/user.entity.js';
import type { Email } from '../../src/domain/value-objects/email.value-object.js';
import type { SessionId, TokenHash, UserId } from '../../src/domain/value-objects/identifiers.js';

type Tables = {
  users: Map<string, UserProps>;
  sessions: Map<string, SessionProps>;
  oneTimeTokens: Map<string, OneTimeTokenProps>;
};

/**
 * Test double for the Postgres adapter. Stores COPIES of aggregate state, like a real database
 * would: had it kept the objects themselves, a use case that mutates an aggregate but forgets
 * to save it would still pass. Also mimics the UNIQUE email index and transaction rollback.
 */
export class InMemoryDatabase {
  tables: Tables = { users: new Map(), sessions: new Map(), oneTimeTokens: new Map() };

  readonly repositories: Repositories = {
    users: new InMemoryUserRepository(this),
    sessions: new InMemorySessionRepository(this),
    oneTimeTokens: new InMemoryOneTimeTokenRepository(this),
  };

  readonly unitOfWork: UnitOfWork = new InMemoryUnitOfWork(this);
}

/** Rolls back every write made inside `work` when it throws. */
class InMemoryUnitOfWork implements UnitOfWork {
  constructor(private readonly db: InMemoryDatabase) {}

  async run<T>(work: (repositories: Repositories) => Promise<T>): Promise<T> {
    const snapshot: Tables = {
      users: new Map(this.db.tables.users),
      sessions: new Map(this.db.tables.sessions),
      oneTimeTokens: new Map(this.db.tables.oneTimeTokens),
    };
    try {
      return await work(this.db.repositories);
    } catch (error) {
      this.db.tables = snapshot;
      throw error;
    }
  }
}

class InMemoryUserRepository implements UserRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  async findById(id: UserId): Promise<User | null> {
    const props = this.db.tables.users.get(id);
    return props ? User.restore({ ...props }) : null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    for (const props of this.db.tables.users.values()) {
      if (props.email.equals(email)) return User.restore({ ...props });
    }
    return null;
  }

  async save(user: User): Promise<void> {
    // Mimics the UNIQUE index on users.email.
    for (const props of this.db.tables.users.values()) {
      if (props.id !== user.id && props.email.equals(user.email)) {
        throw new EmailAlreadyRegisteredError();
      }
    }
    this.db.tables.users.set(user.id, {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      status: user.status,
      role: user.role,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
    });
  }
}

class InMemorySessionRepository implements SessionRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  async findById(id: SessionId): Promise<Session | null> {
    const props = this.db.tables.sessions.get(id);
    return props ? Session.restore({ ...props }) : null;
  }

  async findActiveByUserId(userId: UserId): Promise<Session[]> {
    return [...this.db.tables.sessions.values()]
      .filter((props) => props.userId === userId && props.revokedAt === null)
      .map((props) => Session.restore({ ...props }));
  }

  async save(session: Session): Promise<void> {
    this.db.tables.sessions.set(session.id, {
      id: session.id,
      userId: session.userId,
      currentTokenHash: session.currentTokenHash,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
    });
  }
}

class InMemoryOneTimeTokenRepository implements OneTimeTokenRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  async findByHash(hash: TokenHash, purpose: OneTimeTokenPurpose): Promise<OneTimeToken | null> {
    for (const props of this.db.tables.oneTimeTokens.values()) {
      if (props.tokenHash === hash && props.purpose === purpose) {
        return OneTimeToken.restore({ ...props });
      }
    }
    return null;
  }

  async save(token: OneTimeToken): Promise<void> {
    this.db.tables.oneTimeTokens.set(token.id, {
      id: token.id,
      userId: token.userId,
      purpose: token.purpose,
      tokenHash: token.tokenHash,
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
      consumedAt: token.consumedAt,
    });
  }
}
