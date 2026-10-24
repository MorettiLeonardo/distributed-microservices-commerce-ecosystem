import { Session } from '../../../../domain/entities/session.entity.js';
import { SessionId, TokenHash, UserId } from '../../../../domain/value-objects/identifiers.js';
import type { SessionModel } from '../models/session.model.js';

export const SessionMapper = {
  toDomain(row: SessionModel): Session {
    return Session.restore({
      id: SessionId(row.id),
      userId: UserId(row.userId),
      currentTokenHash: TokenHash(row.currentTokenHash),
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
    });
  },

  toPersistence(session: Session) {
    return {
      id: session.id,
      userId: session.userId,
      currentTokenHash: session.currentTokenHash,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
    };
  },
};
