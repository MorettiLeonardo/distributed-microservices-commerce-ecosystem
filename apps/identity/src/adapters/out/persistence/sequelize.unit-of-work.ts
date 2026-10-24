import type { Sequelize, Transaction } from 'sequelize';
import type { Repositories, UnitOfWork } from '../../../application/ports/unit-of-work.port.js';
import { SequelizeOneTimeTokenRepository } from './repositories/one-time-token.repository.js';
import { SequelizeSessionRepository } from './repositories/session.repository.js';
import { SequelizeUserRepository } from './repositories/user.repository.js';

/** Repositories bound to `transaction`, or autocommit ones when it is null. */
export function createRepositories(transaction: Transaction | null = null): Repositories {
  return {
    users: new SequelizeUserRepository(transaction),
    sessions: new SequelizeSessionRepository(transaction),
    oneTimeTokens: new SequelizeOneTimeTokenRepository(transaction),
  };
}

/**
 * One Postgres transaction per `run`: Sequelize's managed transaction commits when `work`
 * resolves and rolls back when it throws. The transaction is passed explicitly to the
 * repositories — no hidden global context.
 */
export class SequelizeUnitOfWork implements UnitOfWork {
  constructor(private readonly sequelize: Sequelize) {}

  run<T>(work: (repositories: Repositories) => Promise<T>): Promise<T> {
    return this.sequelize.transaction((transaction) => work(createRepositories(transaction)));
  }
}
