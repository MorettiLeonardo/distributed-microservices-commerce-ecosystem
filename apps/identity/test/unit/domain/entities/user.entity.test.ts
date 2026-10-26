import { describe, expect, it } from 'vitest';
import {
  EmailNotVerifiedError,
  UserDisabledError,
} from '../../../../src/domain/errors/user.error.js';
import { Email } from '../../../../src/domain/value-objects/email.value-object.js';
import { PasswordHash, UserId } from '../../../../src/domain/value-objects/identifiers.js';
import { User, type UserProps } from '../../../../src/domain/entities/user.entity.js';

const now = new Date('2026-10-19T12:00:00.000Z');
const later = new Date('2026-10-19T13:00:00.000Z');

function registerUser(): User {
  return User.register({
    id: UserId('user-1'),
    email: Email.create('john@example.com'),
    passwordHash: PasswordHash('hash-1'),
    now,
  });
}

function restoreUser(overrides: Partial<UserProps> = {}): User {
  return User.restore({
    id: UserId('user-1'),
    email: Email.create('john@example.com'),
    passwordHash: PasswordHash('hash-1'),
    status: 'active',
    role: 'customer',
    emailVerifiedAt: now,
    createdAt: now,
    ...overrides,
  });
}

describe('User', () => {
  describe('register', () => {
    it('starts pending verification', () => {
      const user = registerUser();
      expect(user.status).toBe('pending_verification');
      expect(user.role).toBe('customer');
      expect(user.isEmailVerified).toBe(false);
      expect(user.createdAt).toEqual(now);
    });

    it('records UserRegistered', () => {
      expect(registerUser().pullEvents()).toEqual([
        { type: 'UserRegistered', userId: 'user-1', email: 'john@example.com', occurredAt: now },
      ]);
    });
  });

  describe('restore', () => {
    it('records no events', () => {
      expect(restoreUser().pullEvents()).toEqual([]);
    });
  });

  describe('pullEvents', () => {
    it('drains the recorded events', () => {
      const user = registerUser();
      user.pullEvents();
      expect(user.pullEvents()).toEqual([]);
    });
  });

  describe('verifyEmail', () => {
    it('activates the user and records UserEmailVerified', () => {
      const user = registerUser();
      user.pullEvents();

      user.verifyEmail(later);

      expect(user.status).toBe('active');
      expect(user.emailVerifiedAt).toEqual(later);
      expect(user.pullEvents()).toEqual([
        { type: 'UserEmailVerified', userId: 'user-1', occurredAt: later },
      ]);
    });

    it('is idempotent for an already-verified user', () => {
      const user = restoreUser({ emailVerifiedAt: now });

      user.verifyEmail(later);

      expect(user.emailVerifiedAt).toEqual(now);
      expect(user.pullEvents()).toEqual([]);
    });

    it('rejects a disabled user', () => {
      const user = restoreUser({ status: 'disabled', emailVerifiedAt: null });
      expect(() => user.verifyEmail(later)).toThrow(UserDisabledError);
    });
  });

  describe('changePassword', () => {
    it('replaces the hash and records UserPasswordChanged', () => {
      const user = restoreUser();

      user.changePassword(PasswordHash('hash-2'), later);

      expect(user.passwordHash).toBe('hash-2');
      expect(user.pullEvents()).toEqual([
        { type: 'UserPasswordChanged', userId: 'user-1', occurredAt: later },
      ]);
    });

    it('rejects a disabled user', () => {
      const user = restoreUser({ status: 'disabled' });
      expect(() => user.changePassword(PasswordHash('hash-2'), later)).toThrow(UserDisabledError);
    });
  });

  describe('requestPasswordReset', () => {
    it('records UserPasswordResetRequested without changing state', () => {
      const user = restoreUser();

      user.requestPasswordReset(later);

      expect(user.passwordHash).toBe('hash-1');
      expect(user.pullEvents()).toEqual([
        { type: 'UserPasswordResetRequested', userId: 'user-1', occurredAt: later },
      ]);
    });
  });

  describe('promoteToAdmin', () => {
    it('makes an active customer an admin without recording events', () => {
      const user = restoreUser();

      user.promoteToAdmin();

      expect(user.role).toBe('admin');
      expect(user.pullEvents()).toEqual([]);
    });

    it('is idempotent for an admin', () => {
      const user = restoreUser({ role: 'admin' });

      user.promoteToAdmin();

      expect(user.role).toBe('admin');
    });

    it('rejects a user whose email is not verified', () => {
      const user = restoreUser({ status: 'pending_verification', emailVerifiedAt: null });

      expect(() => user.promoteToAdmin()).toThrow(EmailNotVerifiedError);
      expect(user.role).toBe('customer');
    });

    it('rejects a disabled user', () => {
      const user = restoreUser({ status: 'disabled' });

      expect(() => user.promoteToAdmin()).toThrow(UserDisabledError);
    });
  });
});
