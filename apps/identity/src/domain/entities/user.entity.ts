import { AggregateRoot } from '@ecommerce/ddd';
import { EmailNotVerifiedError, UserDisabledError } from '#src/domain/errors/user.error.js';
import type { UserEvent } from '#src/domain/events/user.events.js';
import type { Email } from '#src/domain/value-objects/email.value-object.js';
import type { PasswordHash, UserId } from '#src/domain/value-objects/identifiers.js';

export const UserStatus = {
  PendingVerification: 'pending_verification',
  Active: 'active',
  Disabled: 'disabled',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

/** What the user may do across services; carried in the access token (ADR 0012). */
export const UserRole = {
  Customer: 'customer',
  Admin: 'admin',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export type UserProps = {
  id: UserId;
  email: Email;
  passwordHash: PasswordHash;
  status: UserStatus;
  role: UserRole;
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
      status: UserStatus.PendingVerification,
      role: UserRole.Customer,
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

  get role(): UserRole {
    return this.props.role;
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

    this.props = { ...this.props, status: UserStatus.Active, emailVerifiedAt: now };
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

  /**
   * Only an active user (verified email) can become an admin: an unverified address could belong
   * to someone else. Idempotent. Emits nothing: no one reacts yet; the caller logs it for audit.
   */
  promoteToAdmin(): void {
    this.ensureNotDisabled();
    if (!this.isEmailVerified) throw new EmailNotVerifiedError();
    this.props = { ...this.props, role: UserRole.Admin };
  }

  private ensureNotDisabled(): void {
    if (this.props.status === UserStatus.Disabled) throw new UserDisabledError();
  }
}
