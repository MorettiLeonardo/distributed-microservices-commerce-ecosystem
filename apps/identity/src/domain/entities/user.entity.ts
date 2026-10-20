import { UserDisabledError } from '../errors/user.error.js';
import type { UserEvent } from '../events/user.events.js';
import { AggregateRoot } from '../shared/aggregate-root.js';
import type { Email } from '../value-objects/email.value-object.js';
import type { PasswordHash, UserId } from '../value-objects/identifiers.js';

export const UserStatus = ['pending_verification', 'active', 'disabled'] as const;
export type UserStatus = (typeof UserStatus)[number];

export type UserProps = {
  id: UserId;
  email: Email;
  passwordHash: PasswordHash;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  createdAt: Date;
};

export class User extends AggregateRoot<UserEvent> {
  private constructor(private props: UserProps) {
    super();
  }

  /** Creates a brand-new user. Emits `UserRegistered`. */
  static register(input: {
    id: UserId;
    email: Email;
    passwordHash: PasswordHash;
    now: Date;
  }): User {
    const user = new User({
      id: input.id,
      email: input.email,
      passwordHash: input.passwordHash,
      status: 'pending_verification',
      emailVerifiedAt: null,
      createdAt: input.now,
    });
    user.record({
      type: 'UserRegistered',
      userId: input.id,
      email: input.email.value,
      occurredAt: input.now,
    });
    return user;
  }

  /** Rebuilds a user from persistence. Emits nothing — nothing happened. */
  static restore(props: UserProps): User {
    return new User({ ...props });
  }

  get id(): UserId {
    return this.props.id;
  }

  get email(): Email {
    return this.props.email;
  }

  get passwordHash(): PasswordHash {
    return this.props.passwordHash;
  }

  get status(): UserStatus {
    return this.props.status;
  }

  get emailVerifiedAt(): Date | null {
    return this.props.emailVerifiedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get isEmailVerified(): boolean {
    return this.props.emailVerifiedAt !== null;
  }

  /** Idempotent: verifying an already-verified email changes nothing and emits nothing. */
  verifyEmail(now: Date): void {
    this.ensureNotDisabled();
    if (this.isEmailVerified) return;

    this.props = { ...this.props, status: 'active', emailVerifiedAt: now };
    this.record({ type: 'UserEmailVerified', userId: this.id, occurredAt: now });
  }

  requestPasswordReset(now: Date): void {
    this.ensureNotDisabled();
    this.record({ type: 'UserPasswordResetRequested', userId: this.id, occurredAt: now });
  }

  /**
   * Revoking the user's sessions (invariant 7) spans other aggregates,
   * so it is orchestrated by the use case reacting to this change.
   */
  changePassword(newHash: PasswordHash, now: Date): void {
    this.ensureNotDisabled();
    this.props = { ...this.props, passwordHash: newHash };
    this.record({ type: 'UserPasswordChanged', userId: this.id, occurredAt: now });
  }

  private ensureNotDisabled(): void {
    if (this.props.status === 'disabled') throw new UserDisabledError();
  }
}
