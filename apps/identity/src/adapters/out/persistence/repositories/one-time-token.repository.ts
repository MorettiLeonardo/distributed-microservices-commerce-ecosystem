import type { Transaction } from 'sequelize';
import type { OneTimeTokenRepository } from '../../../../application/ports/one-time-token.repository.port.js';
import type {
  OneTimeToken,
  OneTimeTokenPurpose,
} from '../../../../domain/entities/one-time-token.entity.js';
import type { TokenHash } from '../../../../domain/value-objects/identifiers.js';
import { OneTimeTokenMapper } from '../mappers/one-time-token.mapper.js';
import { OneTimeTokenModel } from '../models/one-time-token.model.js';

export class SequelizeOneTimeTokenRepository implements OneTimeTokenRepository {
  constructor(private readonly transaction: Transaction | null = null) {}

  async findByHash(hash: TokenHash, purpose: OneTimeTokenPurpose): Promise<OneTimeToken | null> {
    const row = await OneTimeTokenModel.findOne({
      where: { tokenHash: hash, purpose },
      transaction: this.transaction,
    });
    return row ? OneTimeTokenMapper.toDomain(row) : null;
  }

  async save(token: OneTimeToken): Promise<void> {
    await OneTimeTokenModel.upsert(OneTimeTokenMapper.toPersistence(token), {
      transaction: this.transaction,
    });
  }
}
