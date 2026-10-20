import type { User } from '../../domain/entities/user.entity.js';
import type { Email } from '../../domain/value-objects/email.value-object.js';
import type { UserId } from '../../domain/value-objects/identifiers.js';

export interface UserRepository {
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  save(user: User): Promise<void>;
}
