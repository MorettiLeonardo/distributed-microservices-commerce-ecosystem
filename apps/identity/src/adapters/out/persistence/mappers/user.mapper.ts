import { User, UserRole, UserStatus } from '#src/domain/entities/user.entity.js';
import { Email } from '#src/domain/value-objects/email.value-object.js';
import { PasswordHash, UserId } from '#src/domain/value-objects/identifiers.js';
import type { UserModel } from '#src/adapters/out/persistence/models/user.model.js';

export const UserMapper = {
  toDomain(row: UserModel): User {
    return User.restore({
      id: UserId(row.id),
      email: Email.create(row.email),
      passwordHash: PasswordHash(row.passwordHash),
      status: parseStatus(row.status),
      role: parseRole(row.role),
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
      role: user.role,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
    };
  },
};

function parseStatus(value: string): UserStatus {
  const status = Object.values(UserStatus).find((known) => known === value);
  if (!status) throw new Error(`Unknown user status in database: ${value}`);
  return status;
}

function parseRole(value: string): UserRole {
  const role = Object.values(UserRole).find((known) => known === value);
  if (!role) throw new Error(`Unknown user role in database: ${value}`);
  return role;
}
