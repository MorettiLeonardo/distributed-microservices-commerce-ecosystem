import type { UserId } from '../value-objects/identifiers.js';

type UserEventBase = {
  readonly userId: UserId;
  readonly occurredAt: Date;
};

export type UserRegistered = UserEventBase & {
  readonly type: 'UserRegistered';
  readonly email: string;
};

export type UserEmailVerified = UserEventBase & {
  readonly type: 'UserEmailVerified';
};

export type UserPasswordResetRequested = UserEventBase & {
  readonly type: 'UserPasswordResetRequested';
};

export type UserPasswordChanged = UserEventBase & {
  readonly type: 'UserPasswordChanged';
};

export type UserEvent =
  UserRegistered | UserEmailVerified | UserPasswordResetRequested | UserPasswordChanged;
