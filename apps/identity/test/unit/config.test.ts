import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';

const required = {
  JWT_PRIVATE_KEY: JSON.stringify({ kty: 'EC', crv: 'P-256' }),
  DATABASE_URL: 'postgres://identity:identity@localhost:5401/identity',
  REDIS_URL: 'redis://localhost:6301',
  AWS_REGION: 'us-east-1',
  IDENTITY_EVENTS_TOPIC_ARN: 'arn:aws:sns:us-east-1:000000000000:ecommerce-identity-events',
  SEND_EMAIL_QUEUE_URL: 'http://localhost:4566/000000000000/ecommerce-notification-send-email',
};

describe('loadConfig', () => {
  it('applies defaults and converts units', () => {
    const config = loadConfig(required);

    expect(config).toMatchObject({
      env: 'development',
      port: 3001,
      bcryptCost: 12,
      sessionTtlMs: 30 * 24 * 60 * 60 * 1000,
      jwt: { accessTokenTtlMs: 15 * 60_000, privateKey: { kty: 'EC', crv: 'P-256' } },
      aws: { region: 'us-east-1', endpoint: undefined },
    });
  });

  it('coerces numeric variables from strings', () => {
    expect(loadConfig({ ...required, PORT: '8080' }).port).toBe(8080);
  });

  it.each(Object.keys(required))('fails fast when %s is missing', (name) => {
    const { [name as keyof typeof required]: _missing, ...env } = required;

    expect(() => loadConfig(env)).toThrow(name);
  });

  it('fails fast when the signing key is not JSON', () => {
    expect(() => loadConfig({ ...required, JWT_PRIVATE_KEY: 'not json' })).toThrow(/JSON object/);
  });

  it('rejects a database URL that is not Postgres', () => {
    expect(() => loadConfig({ ...required, DATABASE_URL: 'mysql://localhost/x' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => loadConfig({ ...required, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });
});
