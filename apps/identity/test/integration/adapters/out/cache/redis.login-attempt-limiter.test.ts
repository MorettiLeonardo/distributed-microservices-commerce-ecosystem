import { setTimeout as sleep } from 'node:timers/promises';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createRedisClient,
  type RedisClient,
} from '../../../../../src/adapters/out/cache/redis.client.js';
import { RedisLoginAttemptLimiter } from '../../../../../src/adapters/out/cache/redis.login-attempt-limiter.js';
import { Email } from '../../../../../src/domain/value-objects/email.value-object.js';
import { FakeClock } from '../../../../support/fakes.js';

const limits = {
  maxAttemptsPerIp: 3,
  ipWindowSeconds: 1,
  maxFailures: 2,
  failureWindowSeconds: 1,
  lockSeconds: 1,
};
const email = Email.create('john@example.com');
const IP = '203.0.113.7';

describe('RedisLoginAttemptLimiter', () => {
  let container: StartedRedisContainer;
  let redis: RedisClient;
  let clock: FakeClock;
  let limiter: RedisLoginAttemptLimiter;

  beforeAll(async () => {
    container = await new RedisContainer('redis:8.6-alpine').start();
    redis = createRedisClient(container.getConnectionUrl());
    await redis.connect();
  }, 120_000);

  afterAll(async () => {
    await redis?.close();
    await container?.stop();
  });

  beforeEach(async () => {
    await redis.flushAll();
    clock = new FakeClock(new Date('2026-10-19T12:00:00.000Z'));
    limiter = new RedisLoginAttemptLimiter(redis, clock, limits);
  });

  async function attempt(times: number): Promise<boolean[]> {
    const results: boolean[] = [];
    for (let i = 0; i < times; i++) results.push(await limiter.registerAttempt(IP));
    return results;
  }

  it('allows attempts up to the per-IP limit, then refuses', async () => {
    expect(await attempt(4)).toEqual([true, true, true, false]);
  });

  it('opens a new window once the previous one expires', async () => {
    await attempt(4);
    await sleep(1100);

    expect(await limiter.registerAttempt(IP)).toBe(true);
  });

  it('does not extend the window on every attempt (EXPIRE NX)', async () => {
    await limiter.registerAttempt(IP);
    await sleep(600);
    await limiter.registerAttempt(IP);

    // Had each attempt reset the TTL, the key would still have ~1000 ms left.
    expect(await redis.pTTL('rl:ip:203.0.113.7')).toBeLessThan(500);
  });

  it('locks the account after the maximum failures and reports until when', async () => {
    expect(await limiter.registerFailure(email)).toBeNull();
    const until = await limiter.registerFailure(email);

    expect(until).toEqual(new Date('2026-10-19T12:00:01.000Z'));
    expect(await limiter.lockedUntil(email)).toEqual(until);
  });

  it('releases the lock when it expires', async () => {
    await limiter.registerFailure(email);
    await limiter.registerFailure(email);
    await sleep(1100);

    expect(await limiter.lockedUntil(email)).toBeNull();
  });

  it('starts counting failures from zero after a successful login', async () => {
    await limiter.registerFailure(email);
    await limiter.clearFailures(email);

    expect(await limiter.registerFailure(email)).toBeNull();
  });
});
