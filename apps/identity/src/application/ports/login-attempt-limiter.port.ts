import type { Email } from '../../domain/value-objects/email.value-object.js';

/** Brute-force protection (ADR 0007). Thresholds and windows belong to the implementation. */
export interface LoginAttemptLimiter {
  /** Counts a login attempt from `ip`; returns false once the IP exceeds its rate limit. */
  registerAttempt(ip: string): Promise<boolean>;

  /** The time the lock on `email` ends, or null when it is not locked. */
  lockedUntil(email: Email): Promise<Date | null>;

  /** Counts a failed login; returns the lock expiry when this failure triggered a lockout. */
  registerFailure(email: Email): Promise<Date | null>;

  clearFailures(email: Email): Promise<void>;
}
