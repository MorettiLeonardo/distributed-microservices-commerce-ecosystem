import { type Transaction, UniqueConstraintError } from 'sequelize';
import { EmailAlreadyRegisteredError } from '#src/application/errors/email-already-registered.error.js';
import type { UserRepository } from '#src/application/ports/user.repository.port.js';
import type { User } from '#src/domain/entities/user.entity.js';
import type { Email } from '#src/domain/value-objects/email.value-object.js';
import type { UserId } from '#src/domain/value-objects/identifiers.js';
import { UserMapper } from '#src/adapters/out/persistence/mappers/user.mapper.js';
import { UserModel } from '#src/adapters/out/persistence/models/user.model.js';

export class SequelizeUserRepository implements UserRepository {
  /** Without a transaction, every call runs on its own connection (autocommit). */
  constructor(private readonly transaction: Transaction | null = null) {}

  async findById(id: UserId): Promise<User | null> {
    const row = await UserModel.findByPk(id, { transaction: this.transaction });
    return row ? UserMapper.toDomain(row) : null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const row = await UserModel.findOne({
      where: { email: email.value },
      transaction: this.transaction,
    });
    return row ? UserMapper.toDomain(row) : null;
  }

  async save(user: User): Promise<void> {
    try {
      await UserModel.upsert(UserMapper.toPersistence(user), { transaction: this.transaction });
    } catch (error) {
      // The UNIQUE index on email is the last line of defense against concurrent registrations.
      if (error instanceof UniqueConstraintError && 'email' in (error.fields ?? {})) {
        throw new EmailAlreadyRegisteredError();
      }
      throw error;
    }
  }
}
