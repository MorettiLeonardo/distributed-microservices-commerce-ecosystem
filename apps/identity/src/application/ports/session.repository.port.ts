import type { Session } from '../../domain/entities/session.entity.js';
import type { SessionId, UserId } from '../../domain/value-objects/identifiers.js';

export interface SessionRepository {
  findById(id: SessionId): Promise<Session | null>;
  /** Sessions of the user that have not been revoked. */
  findActiveByUserId(userId: UserId): Promise<Session[]>;
  save(session: Session): Promise<void>;
}
