import type { Session } from '#src/domain/entities/session.entity.js';
import type { SessionId, UserId } from '#src/domain/value-objects/identifiers.js';

export interface SessionRepository {
  findById(id: SessionId): Promise<Session | null>;
  /** Sessions of the user that have not been revoked. */
  findActiveByUserId(userId: UserId): Promise<Session[]>;
  save(session: Session): Promise<void>;
}
