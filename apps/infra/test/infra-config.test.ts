import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parse } from 'dotenv';
import { describe, expect, it } from 'vitest';
import { readEnvFile, REPO_ROOT, resolveEnvFilePath } from '../src/config/env-file';
import {
  INFRA_ENV_KEYS,
  InfraConfigError,
  loadInfraConfig,
} from '../src/config/infra-config';

const BASE = {
  AWS_ACCOUNT_ID: '123456789012',
  AWS_REGION: 'sa-east-1',
  DOMAIN_NAME: 'exemplo.com.br',
};

function problemsOf(raw: Record<string, string>): string[] {
  try {
    loadInfraConfig(raw);
  } catch (error) {
    if (error instanceof InfraConfigError) return error.problems;
    throw error;
  }
  throw new Error('expected an InfraConfigError');
}

describe('loadInfraConfig', () => {
  it('lists every problem at once: missing required variables and invalid values', () => {
    const problems = problemsOf({ AWS_ACCOUNT_ID: '123', AWS_REGION: 'sa-east-1', ENV_SIZE: 'grande' });

    expect(problems).toEqual([
      'AWS_ACCOUNT_ID: "123" inválido (conta AWS com 12 dígitos)',
      'DOMAIN_NAME: obrigatória (nome de uma hosted zone existente no Route 53, por exemplo exemplo.com.br)',
      'ENV_SIZE: "grande" inválido (valores aceitos: demo, load)',
    ]);
  });

  it('builds the message of the error with all the problems', () => {
    expect(() => loadInfraConfig({})).toThrow(/3 problema\(s\)[\s\S]*AWS_ACCOUNT_ID[\s\S]*AWS_REGION[\s\S]*DOMAIN_NAME/);
  });

  it('applies the demo profile by default', () => {
    const { config, warnings } = loadInfraConfig(BASE);

    expect(config).toMatchObject({
      envName: 'jaja',
      apiDomainName: 'api.jaja.exemplo.com.br',
      size: 'demo',
      network: { maxAzs: 2 },
      backend: { desiredCount: 1, maxCount: 1, cpu: 512, memory: 1024, dbPoolMax: 10 },
      database: { instanceClass: 't4g.micro', multiAz: false },
      broker: {
        instanceType: 'mq.m7g.medium',
        deploymentMode: 'SINGLE_INSTANCE',
        engineVersion: '4.2',
        queueType: 'classic',
      },
      logRetentionDays: 3,
      app: { corsOrigin: '', orderSimulationDelayFactor: '1', seedOnDeploy: false, devToolsEnabled: false },
      appSecretNames: {},
    });
    expect(warnings).toEqual([]);
  });

  it('applies the load profile and overrides only the dimension that was given', () => {
    const { config } = loadInfraConfig({ ...BASE, ENV_SIZE: 'load', BACKEND_MAX_COUNT: '10' });

    expect(config.backend).toEqual({ desiredCount: 2, maxCount: 10, cpu: 1024, memory: 2048, dbPoolMax: 10 });
    expect(config.database).toEqual({ instanceClass: 'm7g.large', multiAz: true });
    expect(config.broker).toMatchObject({ deploymentMode: 'CLUSTER_MULTI_AZ', queueType: 'quorum' });
    expect(config.network.maxAzs).toBe(3);
  });

  it('warns about risky combinations of broker and queue type', () => {
    expect(loadInfraConfig({ ...BASE, RABBITMQ_QUEUE_TYPE: 'quorum' }).warnings[0]).toMatch(
      /instância única com filas quorum/,
    );
    expect(
      loadInfraConfig({ ...BASE, ENV_SIZE: 'load', RABBITMQ_QUEUE_TYPE: 'classic' }).warnings[0],
    ).toMatch(/cluster com filas classic/);
  });

  it('warns that the seed users have known passwords', () => {
    expect(loadInfraConfig({ ...BASE, SEED_ON_DEPLOY: 'true' }).warnings).toEqual([
      expect.stringMatching(/senhas conhecidas/),
    ]);
  });

  it('accepts DB_POOL_MAX from 1 to 100', () => {
    expect(loadInfraConfig({ ...BASE, DB_POOL_MAX: '30' }).config.backend.dbPoolMax).toBe(30);
    expect(problemsOf({ ...BASE, DB_POOL_MAX: '0' })).toEqual(['DB_POOL_MAX: "0" inválido (inteiro de 1 a 100)']);
  });

  it('warns that the load test places real orders', () => {
    const config = loadInfraConfig({ ...BASE, DEV_TOOLS_ENABLED: 'true' });

    expect(config.config.app.devToolsEnabled).toBe(true);
    expect(config.warnings).toEqual([expect.stringMatching(/teste de carga/)]);
  });

  it('rejects a memory that does not match the CPU and a maximum below the initial count', () => {
    expect(
      problemsOf({ ...BASE, BACKEND_CPU: '256', BACKEND_MEMORY: '4096', BACKEND_DESIRED_COUNT: '3', BACKEND_MAX_COUNT: '2' }),
    ).toEqual([
      'BACKEND_MAX_COUNT: 2 menor que BACKEND_DESIRED_COUNT (3)',
      'BACKEND_MEMORY: 4096 não combina com BACKEND_CPU 256 (aceitos: 512 a 2048 MiB, em 512, 1024 ou 2048)',
    ]);
  });

  it('rejects invalid booleans, origins, retention, delay factor and a short JWT secret', () => {
    expect(
      problemsOf({
        ...BASE,
        DB_MULTI_AZ: 'sim',
        CORS_ORIGIN: 'http://localhost:3000,localhost/app',
        LOG_RETENTION_DAYS: '2',
        ORDER_SIMULATION_DELAY_FACTOR: '11',
        JWT_SECRET: 'curto',
      }),
    ).toEqual([
      'DB_MULTI_AZ: "sim" inválido (valores aceitos: true, false)',
      'LOG_RETENTION_DAYS: "2" inválido (valores aceitos: 1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365)',
      'JWT_SECRET: curto demais (mínimo de 32 caracteres; vazio gera um aleatório)',
      'CORS_ORIGIN: "localhost/app" inválida (origem como http://localhost:3000, sem caminho)',
      'ORDER_SIMULATION_DELAY_FACTOR: "11" inválido (número de 0 a 10)',
    ]);
  });

  it('keeps the secrets of the .env apart from the config, which holds only their names', () => {
    const jwt = 'x'.repeat(40);
    const { config, secrets } = loadInfraConfig({
      ...BASE,
      ENV_NAME: 'jaja-load',
      JWT_SECRET: jwt,
      GOOGLE_MAPS_API_KEY: 'AIza-teste',
      CORS_ORIGIN: ' http://localhost:3000/ , https://jaja.exemplo.com.br',
    });

    expect(secrets).toEqual({ jwtSecret: jwt, googleMapsApiKey: 'AIza-teste' });
    expect(config.appSecretNames).toEqual({
      jwtSecret: 'jaja-load/app/jwt-secret',
      googleMapsApiKey: 'jaja-load/app/google-maps-api-key',
    });
    expect(config.app.corsOrigin).toBe('http://localhost:3000,https://jaja.exemplo.com.br');
    expect(JSON.stringify(config)).not.toContain(jwt);
    expect(JSON.stringify(config)).not.toContain('AIza-teste');
  });
});

describe('env file', () => {
  it('uses apps/infra/.env by default and INFRA_ENV_FILE relative to the repository root', () => {
    expect(resolveEnvFilePath(undefined, '/repo')).toBe('/repo/apps/infra/.env');
    expect(resolveEnvFilePath('apps/infra/.env.load', '/repo')).toBe('/repo/apps/infra/.env.load');
    expect(resolveEnvFilePath('/tmp/outro.env', '/repo')).toBe('/tmp/outro.env');
  });

  it('fails with a clear message when the file does not exist', () => {
    expect(() => readEnvFile('/nao/existe/.env')).toThrow(
      /Arquivo de ambiente não encontrado: \/nao\/existe\/\.env\. Copie apps\/infra\/\.env\.example/,
    );
  });

  it('reads the file without changing process.env', () => {
    const dir = mkdtempSync(join(tmpdir(), 'jaja-infra-'));
    const file = join(dir, '.env');
    writeFileSync(file, 'AWS_REGION=us-east-1\nJAJA_INFRA_TEST_ONLY=1\n');

    expect(readEnvFile(file)).toEqual({ AWS_REGION: 'us-east-1', JAJA_INFRA_TEST_ONLY: '1' });
    expect(process.env.JAJA_INFRA_TEST_ONLY).toBeUndefined();
  });

  it('documents in .env.example every variable read by loadInfraConfig, and nothing else', () => {
    const example = parse(readFileSync(resolve(REPO_ROOT, 'apps/infra/.env.example'), 'utf8'));

    expect(Object.keys(example).sort()).toEqual([...INFRA_ENV_KEYS].sort());
  });
});
