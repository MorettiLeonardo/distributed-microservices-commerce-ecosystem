import type { User } from '#src/domain/entities/user.entity.js';
import type { Email } from '#src/domain/value-objects/email.value-object.js';
import type { UserId } from '#src/domain/value-objects/identifiers.js';

export interface UserRepository {
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  save(user: User): Promise<void>;
}
