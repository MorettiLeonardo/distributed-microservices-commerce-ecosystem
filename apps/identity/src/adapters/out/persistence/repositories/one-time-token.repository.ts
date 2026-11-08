import type { Transaction } from 'sequelize';
import type { OneTimeTokenRepository } from '#src/application/ports/one-time-token.repository.port.js';
import type {
  OneTimeToken,
  OneTimeTokenPurpose,
} from '#src/domain/entities/one-time-token.entity.js';
import type { TokenHash } from '#src/domain/value-objects/identifiers.js';
import { OneTimeTokenMapper } from '#src/adapters/out/persistence/mappers/one-time-token.mapper.js';
import { OneTimeTokenModel } from '#src/adapters/out/persistence/models/one-time-token.model.js';

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
