import type { Clock } from '../../../application/ports/clock.port.js';
import type { LoginAttemptLimiter } from '../../../application/ports/login-attempt-limiter.port.js';
import type { Email } from '../../../domain/value-objects/email.value-object.js';
import type { RedisClient } from './redis.client.js';

export type LoginAttemptLimits = {
  maxAttemptsPerIp: number;
  ipWindowSeconds: number;
  maxFailures: number;
  failureWindowSeconds: number;
  lockSeconds: number;
};

/** ADR 0007: 20 attempts/min per IP; 5 failures in 15 min lock the account for 15 min. */
export const DEFAULT_LOGIN_ATTEMPT_LIMITS: LoginAttemptLimits = {
  maxAttemptsPerIp: 20,
  ipWindowSeconds: 60,
  maxFailures: 5,
  failureWindowSeconds: 15 * 60,
  lockSeconds: 15 * 60,
};

const keys = {
  ipAttempts: (ip: string) => `rl:ip:${ip}`,
  failures: (email: Email) => `fail:user:${email.value}`,
  lock: (email: Email) => `lock:user:${email.value}`,
};

/**
 * Fixed-window counters in Redis, shared by every instance of the service.
 * `EXPIRE ... NX` sets the TTL only when the window opens: refreshing it on every hit would let
 * a persistent attacker (or user) keep the window open forever.
 */
export class RedisLoginAttemptLimiter implements LoginAttemptLimiter {
  constructor(
    private readonly redis: RedisClient,
    private readonly clock: Clock,
    private readonly limits: LoginAttemptLimits = DEFAULT_LOGIN_ATTEMPT_LIMITS,
  ) {}

  async registerAttempt(ip: string): Promise<boolean> {
    const attempts = await this.increment(keys.ipAttempts(ip), this.limits.ipWindowSeconds);
    return attempts <= this.limits.maxAttemptsPerIp;
  }

  async lockedUntil(email: Email): Promise<Date | null> {
    const until = await this.redis.get(keys.lock(email));
    return until ? new Date(until) : null;
  }

  async registerFailure(email: Email): Promise<Date | null> {
    const failures = await this.increment(keys.failures(email), this.limits.failureWindowSeconds);
    if (failures < this.limits.maxFailures) return null;

    const until = new Date(this.clock.now().getTime() + this.limits.lockSeconds * 1000);
    // The lock expires by itself; its value says when, so the API can answer Retry-After.
    await this.redis
      .multi()
      .set(keys.lock(email), until.toISOString(), {
        expiration: { type: 'EX', value: this.limits.lockSeconds },
      })
      .del(keys.failures(email))
      .exec();
    return until;
  }

  async clearFailures(email: Email): Promise<void> {
    await this.redis.del(keys.failures(email));
  }

  private async increment(key: string, windowSeconds: number): Promise<number> {
    const [count] = await this.redis.multi().incr(key).expire(key, windowSeconds, 'NX').exec();
    return Number(count);
  }
}
