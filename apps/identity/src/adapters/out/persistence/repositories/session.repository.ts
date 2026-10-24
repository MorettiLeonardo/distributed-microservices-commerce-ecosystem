import type { Transaction } from 'sequelize';
import type { SessionRepository } from '../../../../application/ports/session.repository.port.js';
import type { Session } from '../../../../domain/entities/session.entity.js';
import type { SessionId, UserId } from '../../../../domain/value-objects/identifiers.js';
import { SessionMapper } from '../mappers/session.mapper.js';
import { SessionModel } from '../models/session.model.js';

export class SequelizeSessionRepository implements SessionRepository {
  constructor(private readonly transaction: Transaction | null = null) {}

  async findById(id: SessionId): Promise<Session | null> {
    const row = await SessionModel.findByPk(id, { transaction: this.transaction });
    return row ? SessionMapper.toDomain(row) : null;
  }

  async findActiveByUserId(userId: UserId): Promise<Session[]> {
    const rows = await SessionModel.findAll({
      where: { userId, revokedAt: null },
      transaction: this.transaction,
    });
    return rows.map((row) => SessionMapper.toDomain(row));
  }

  async save(session: Session): Promise<void> {
    await SessionModel.upsert(SessionMapper.toPersistence(session), {
      transaction: this.transaction,
    });
  }
}
