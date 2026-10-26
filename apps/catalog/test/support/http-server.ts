import type { AddressInfo } from 'node:net';
import type { ReadinessCheck } from '@ecommerce/http';
import { createApp } from '../../src/adapters/in/http/app.js';
import { createLogger } from '../../src/logger.js';

export type TestServer = {
  request: (path: string, init?: RequestInit) => Promise<Response>;
  close: () => Promise<void>;
};

/** Starts the real Express app on a random port, so tests go through actual HTTP. */
export async function startTestServer(
  options: { readinessChecks?: ReadinessCheck[] } = {},
): Promise<TestServer> {
  const app = createApp({
    readinessChecks: options.readinessChecks ?? [],
    logger: createLogger({ level: 'silent', enabled: false }),
  });

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    request: (path, init) => fetch(`${baseUrl}${path}`, init),
    close: () => new Promise((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))),
  };
}
