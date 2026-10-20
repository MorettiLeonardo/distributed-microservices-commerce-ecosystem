import type { OneTimeTokenRepository } from './one-time-token.repository.port.js';
import type { SessionRepository } from './session.repository.port.js';
import type { UserRepository } from './user.repository.port.js';

export type Repositories = {
  users: UserRepository;
  sessions: SessionRepository;
  oneTimeTokens: OneTimeTokenRepository;
};

/**
 * Runs `work` atomically: every write made through the given repositories commits together,
 * or none does if `work` throws. Keep slow work (hashing, network calls) outside of it.
 */
export interface UnitOfWork {
  run<T>(work: (repositories: Repositories) => Promise<T>): Promise<T>;
}
