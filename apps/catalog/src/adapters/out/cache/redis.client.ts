import { createClient } from 'redis';

/** Not connected yet: call `connect()`. The return type is the concrete client the adapters use. */
export function createRedisClient(url: string) {
  return createClient({ url });
}

export type RedisClient = ReturnType<typeof createRedisClient>;
