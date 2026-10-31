import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';

const required = {
  DATABASE_URL: 'postgres://catalog:catalog@localhost:5402/catalog',
  REDIS_URL: 'redis://localhost:6302',
  IDENTITY_JWKS_URL: 'http://localhost:3001/.well-known/jwks.json',
};

describe('loadConfig', () => {
  it('applies defaults', () => {
    expect(loadConfig(required)).toEqual({
      env: 'development',
      port: 3002,
      logLevel: 'info',
      databaseUrl: required.DATABASE_URL,
      redisUrl: required.REDIS_URL,
      auth: {
        jwksUrl: required.IDENTITY_JWKS_URL,
        issuer: 'ecommerce-identity',
        audience: 'ecommerce',
      },
    });
  });

  it('coerces numeric variables from strings', () => {
    expect(loadConfig({ ...required, PORT: '8080' }).port).toBe(8080);
  });

  it.each(Object.keys(required))('fails fast when %s is missing', (name) => {
    const { [name as keyof typeof required]: _missing, ...env } = required;

    expect(() => loadConfig(env)).toThrow(name);
  });

  it('rejects a database URL that is not Postgres', () => {
    expect(() => loadConfig({ ...required, DATABASE_URL: 'mysql://localhost/catalog' })).toThrow(
      /DATABASE_URL/,
    );
  });
});
