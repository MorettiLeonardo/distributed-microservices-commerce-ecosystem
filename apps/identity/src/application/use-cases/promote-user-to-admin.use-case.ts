import { UserRole } from '#src/domain/entities/user.entity.js';
import { Email } from '#src/domain/value-objects/email.value-object.js';
import { UserNotFoundError } from '#src/application/errors/user-not-found.error.js';
import type { UserRepository } from '#src/application/ports/user.repository.port.js';

export type PromoteUserToAdminInput = {
  email: string;
};

export type PromoteUserToAdminResult = {
  userId: string;
  email: string;
  alreadyAdmin: boolean;
};

/**
 * Grants the admin role. Deliberately not exposed over HTTP: an endpoint that grants privileges
 * is the first target of privilege escalation, so only an operator script calls it (ADR 0012).
 * The new role reaches the access token on the next login or refresh.
 */
export class PromoteUserToAdmin {
  constructor(private readonly deps: { users: UserRepository }) {}

  async execute(input: PromoteUserToAdminInput): Promise<PromoteUserToAdminResult> {
    const user = await this.deps.users.findByEmail(Email.create(input.email));
    if (!user) throw new UserNotFoundError();

    const alreadyAdmin = user.role === UserRole.Admin;
    user.promoteToAdmin();
    if (!alreadyAdmin) await this.deps.users.save(user);

    return { userId: user.id, email: user.email.value, alreadyAdmin };
  }
}
