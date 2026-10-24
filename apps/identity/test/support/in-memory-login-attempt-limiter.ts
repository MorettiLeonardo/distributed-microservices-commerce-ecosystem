import type { Clock } from '../../src/application/ports/clock.port.js';
import type { LoginAttemptLimiter } from '../../src/application/ports/login-attempt-limiter.port.js';
import type { Email } from '../../src/domain/value-objects/email.value-object.js';

/**
 * Same thresholds as production (ADR 0007), without time windows: counters never reset on
 * their own. Stand-in for the Redis adapter in tests and local runs; state lives in one process.
 */
export class InMemoryLoginAttemptLimiter implements LoginAttemptLimiter {
  static readonly MAX_ATTEMPTS_PER_IP = 20;
  static readonly MAX_FAILURES = 5;
  static readonly LOCK_MS = 15 * 60_000;

  readonly #attemptsByIp = new Map<string, number>();
  readonly #failures = new Map<string, number>();
  readonly #locks = new Map<string, Date>();

  constructor(private readonly clock: Clock) {}

  async registerAttempt(ip: string): Promise<boolean> {
    const attempts = (this.#attemptsByIp.get(ip) ?? 0) + 1;
    this.#attemptsByIp.set(ip, attempts);
    return attempts <= InMemoryLoginAttemptLimiter.MAX_ATTEMPTS_PER_IP;
  }

  async lockedUntil(email: Email): Promise<Date | null> {
    const until = this.#locks.get(email.value);
    return until && until > this.clock.now() ? until : null;
  }

  async registerFailure(email: Email): Promise<Date | null> {
    const failures = (this.#failures.get(email.value) ?? 0) + 1;
    if (failures < InMemoryLoginAttemptLimiter.MAX_FAILURES) {
      this.#failures.set(email.value, failures);
      return null;
    }
    this.#failures.delete(email.value);
    const until = new Date(this.clock.now().getTime() + InMemoryLoginAttemptLimiter.LOCK_MS);
    this.#locks.set(email.value, until);
    return until;
  }

  async clearFailures(email: Email): Promise<void> {
    this.#failures.delete(email.value);
  }
}
