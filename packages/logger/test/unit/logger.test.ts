import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createLogger, requestContext } from '../../src/index.js';

function captureLines() {
  const lines: Record<string, unknown>[] = [];
  const destination = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
      callback();
    },
  });
  return { lines, destination };
}

describe('createLogger', () => {
  it('stamps every line with the service name', () => {
    const { lines, destination } = captureLines();
    createLogger({ service: 'catalog', level: 'info', destination }).info('hello');

    expect(lines[0]).toMatchObject({ service: 'catalog', msg: 'hello' });
  });

  it('always redacts auth headers and also redacts the service paths', () => {
    const { lines, destination } = captureLines();
    const logger = createLogger({
      service: 'identity',
      level: 'info',
      redact: ['*.password'],
      destination,
    });

    logger.info({
      req: { headers: { authorization: 'Bearer secret', cookie: 'sid=secret' } },
      body: { password: 'hunter22', email: 'a@b.c' },
    });

    expect(lines[0]).toMatchObject({
      req: { headers: { authorization: '[REDACTED]', cookie: '[REDACTED]' } },
      body: { password: '[REDACTED]', email: 'a@b.c' },
    });
  });
});

describe('requestContext', () => {
  it('exposes the correlation id only inside the run callback, across awaits', async () => {
    const seen = await requestContext.run({ correlationId: 'trace-1' }, async () => {
      await Promise.resolve();
      return requestContext.correlationId();
    });

    expect(seen).toBe('trace-1');
    expect(requestContext.correlationId()).toBeUndefined();
  });
});
