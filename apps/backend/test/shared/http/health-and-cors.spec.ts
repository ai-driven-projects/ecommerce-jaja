import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { corsOptions } from '../../../src/shared/http/cors-options.js';
import { HealthController } from '../../../src/shared/http/health.controller.js';

const FRONT = 'https://jaja.exemplo.com.br';

async function appWithCors(value: string | undefined): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ controllers: [HealthController] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  app.enableCors(corsOptions(value));
  await app.init();
  return app;
}

describe('corsOptions', () => {
  it('accepts any origin when CORS_ORIGIN is empty or missing', () => {
    expect(corsOptions(undefined)).toEqual({});
    expect(corsOptions(' , ')).toEqual({});
  });

  it('lists the origins separated by commas, without spaces or a trailing slash', () => {
    expect(corsOptions(` http://localhost:3000 ,${FRONT}/`)).toEqual({
      origin: ['http://localhost:3000', FRONT],
    });
  });
});

describe('GET /health and CORS', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('answers 200 with { status: "ok" } without a token', async () => {
    app = await appWithCors(undefined);

    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('sends the CORS headers to an allowed origin', async () => {
    app = await appWithCors(FRONT);

    const response = await request(app.getHttpServer())
      .options('/health')
      .set('Origin', FRONT)
      .set('Access-Control-Request-Method', 'GET');

    expect(response.headers['access-control-allow-origin']).toBe(FRONT);
  });

  it('sends no Access-Control-Allow-Origin to an origin outside the list', async () => {
    app = await appWithCors(FRONT);

    const response = await request(app.getHttpServer())
      .options('/health')
      .set('Origin', 'https://outro.site')
      .set('Access-Control-Request-Method', 'GET');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('accepts the local frontend when CORS_ORIGIN is empty', async () => {
    app = await appWithCors('');

    const response = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'http://localhost:3000');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('*');
  });
});
