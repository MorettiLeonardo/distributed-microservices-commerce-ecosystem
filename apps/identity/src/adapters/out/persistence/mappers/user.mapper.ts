import { User, UserStatus } from '../../../../domain/entities/user.entity.js';
import { Email } from '../../../../domain/value-objects/email.value-object.js';
import { PasswordHash, UserId } from '../../../../domain/value-objects/identifiers.js';
import type { UserModel } from '../models/user.model.js';

export const UserMapper = {
  toDomain(row: UserModel): User {
    return User.restore({
      id: UserId(row.id),
      email: Email.create(row.email),
      passwordHash: PasswordHash(row.passwordHash),
      status: parseStatus(row.status),
      emailVerifiedAt: row.emailVerifiedAt,
      createdAt: row.createdAt,
    });
  },

  toPersistence(user: User) {
    return {
      id: user.id,
      email: user.email.value,
      passwordHash: user.passwordHash,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
    };
  },
};

function parseStatus(value: string): UserStatus {
  const status = UserStatus.find((known) => known === value);
  if (!status) throw new Error(`Unknown user status in database: ${value}`);
  return status;
}
