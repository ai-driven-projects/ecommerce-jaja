import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM module of the image, without type declarations
import { composeEnv, databaseUrlFrom, rabbitMqUrlFrom } from '../../docker/compose-env.mjs';

const DB = {
  DB_HOST: 'jaja.abc123.sa-east-1.rds.amazonaws.com',
  DB_PORT: '5432',
  DB_NAME: 'jaja',
  DB_USER: 'jaja_admin',
  DB_PASSWORD: 'p@ss:w/rd#1',
};

const MQ = {
  RABBITMQ_ENDPOINT: 'amqps://b-1234.mq.sa-east-1.amazonaws.com:5671',
  RABBITMQ_USER: 'jaja',
  RABBITMQ_PASSWORD: 's3nh4/com@especiais',
};

describe('databaseUrlFrom', () => {
  it('builds the URL with the password encoded and the public schema', () => {
    expect(databaseUrlFrom(DB)).toBe(
      'postgresql://jaja_admin:p%40ss%3Aw%2Frd%231@jaja.abc123.sa-east-1.rds.amazonaws.com:5432/jaja?schema=public',
    );
  });

  it('uses port 5432 when DB_PORT is missing', () => {
    expect(databaseUrlFrom({ ...DB, DB_PORT: undefined })).toContain('.amazonaws.com:5432/jaja');
  });

  it('asks pg to verify the certificate with DB_SSL="true"', () => {
    expect(databaseUrlFrom({ ...DB, DB_SSL: 'true' })).toMatch(/\?schema=public&sslmode=verify-full$/);
  });

  it('gives Prisma its own TLS parameters, with the CA of the image by default', () => {
    expect(databaseUrlFrom({ ...DB, DB_SSL: 'true' }, 'prisma')).toMatch(
      /\?schema=public&sslmode=require&sslcert=%2Fapp%2Fcerts%2Frds-global-bundle.pem$/,
    );
    expect(databaseUrlFrom({ ...DB, DB_SSL: 'true', DB_CA_FILE: '/ca.pem' }, 'prisma')).toContain(
      'sslcert=%2Fca.pem',
    );
  });

  it('builds nothing without host, name or user', () => {
    expect(databaseUrlFrom({ ...DB, DB_HOST: '' })).toBeUndefined();
    expect(databaseUrlFrom({ ...DB, DB_NAME: undefined })).toBeUndefined();
    expect(databaseUrlFrom({ ...DB, DB_USER: ' ' })).toBeUndefined();
  });
});

describe('rabbitMqUrlFrom', () => {
  it('puts the encoded credentials into the amqps endpoint', () => {
    expect(rabbitMqUrlFrom(MQ)).toBe(
      'amqps://jaja:s3nh4%2Fcom%40especiais@b-1234.mq.sa-east-1.amazonaws.com:5671',
    );
  });

  it('turns the amqp+ssl endpoint of Amazon MQ into amqps', () => {
    expect(
      rabbitMqUrlFrom({ ...MQ, RABBITMQ_ENDPOINT: 'amqp+ssl://b-1234.mq.sa-east-1.amazonaws.com:5671' }),
    ).toBe('amqps://jaja:s3nh4%2Fcom%40especiais@b-1234.mq.sa-east-1.amazonaws.com:5671');
  });

  it('builds nothing without endpoint or user', () => {
    expect(rabbitMqUrlFrom({ ...MQ, RABBITMQ_ENDPOINT: '' })).toBeUndefined();
    expect(rabbitMqUrlFrom({ ...MQ, RABBITMQ_USER: undefined })).toBeUndefined();
  });
});

describe('composeEnv', () => {
  it('builds both URLs when they are empty', () => {
    const composed = composeEnv({ ...DB, ...MQ, DB_SSL: 'true', DATABASE_URL: '' });

    expect(composed.DATABASE_URL).toContain('sslmode=verify-full');
    expect(composed.RABBITMQ_URL).toMatch(/^amqps:\/\/jaja:/);
  });

  it('never replaces a URL that was given', () => {
    const composed = composeEnv({
      ...DB,
      ...MQ,
      DATABASE_URL: 'postgresql://jaja:jaja@localhost:5433/jaja',
      RABBITMQ_URL: 'amqp://jaja:jaja@localhost:5672',
    });

    expect(composed).toEqual({});
  });

  it('adds nothing when the parts are missing (local development)', () => {
    expect(composeEnv({})).toEqual({});
  });
});
