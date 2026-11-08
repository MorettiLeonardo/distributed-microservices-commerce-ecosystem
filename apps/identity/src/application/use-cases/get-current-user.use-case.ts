import type { UserRole, UserStatus } from '#src/domain/entities/user.entity.js';
import { UserId } from '#src/domain/value-objects/identifiers.js';
import { UserNotFoundError } from '#src/application/errors/user-not-found.error.js';
import type { UserRepository } from '#src/application/ports/user.repository.port.js';

export type GetCurrentUserInput = {
  userId: string;
};

/** A plain read model: adapters never receive domain entities. */
export type CurrentUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  status: UserStatus;
  role: UserRole;
  createdAt: Date;
};

export class GetCurrentUser {
  constructor(private readonly deps: { users: UserRepository }) {}

  async execute(input: GetCurrentUserInput): Promise<CurrentUser> {
    const user = await this.deps.users.findById(UserId(input.userId));
    if (!user) throw new UserNotFoundError();

    return {
      id: user.id,
      email: user.email.value,
      emailVerified: user.isEmailVerified,
      status: user.status,
      role: user.role,
      createdAt: user.createdAt,
    };
  }
}
