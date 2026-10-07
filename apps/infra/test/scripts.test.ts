import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../src/config/env-file';
import { InfraConfigError, loadInfraConfig } from '../src/config/infra-config';
import { deploy } from '../scripts/deploy';
import { destroy } from '../scripts/destroy';
import type { ScriptRuntime } from '../scripts/lib/runtime';

const BASE = { AWS_ACCOUNT_ID: '123456789012', AWS_REGION: 'sa-east-1', DOMAIN_NAME: 'exemplo.com.br' };
const JWT = 'j'.repeat(40);

interface FakeOptions {
  env?: Record<string, string>;
  account?: string;
  cdkCode?: number;
  confirm?: boolean;
  existing?: string[];
}

function fakeRuntime(options: FakeOptions = {}) {
  const calls: string[] = [];
  const lines: string[] = [];
  const stored = new Map<string, string>((options.existing ?? []).map((name) => [name, 'old']));
  const runtime: ScriptRuntime = {
    envFile: join(REPO_ROOT, 'apps/infra/.env'),
    loadConfig: () => loadInfraConfig({ ...BASE, ...options.env }),
    currentAccount: async () => options.account ?? BASE.AWS_ACCOUNT_ID,
    secrets: {
      put: async (region, name, value) => {
        calls.push(`put ${region} ${name}`);
        const existed = stored.has(name);
        stored.set(name, value);
        return existed ? 'updated' : 'created';
      },
      delete: async (region, name) => {
        calls.push(`delete ${region} ${name}`);
        return stored.delete(name) ? 'deleted' : 'missing';
      },
    },
    runCdk: async (args) => {
      calls.push(`cdk ${args.join(' ')}`);
      return options.cdkCode ?? 0;
    },
    confirm: async (question) => {
      calls.push(`confirm ${question}`);
      return options.confirm ?? false;
    },
    log: (message) => lines.push(message),
    error: (message) => lines.push(`ERROR ${message}`),
  };
  return { runtime, calls, lines, stored };
}

describe('deploy script', () => {
  it('writes the secrets of the .env, runs cdk deploy and shows the URL and how to destroy', async () => {
    const { runtime, calls, lines, stored } = fakeRuntime({
      env: { JWT_SECRET: JWT, GOOGLE_MAPS_API_KEY: 'AIza-teste' },
      existing: ['jaja/app/jwt-secret'],
    });

    expect(await deploy(runtime, ['--require-approval', 'never'])).toBe(0);
    expect(calls).toEqual([
      'put sa-east-1 jaja/app/jwt-secret',
      'put sa-east-1 jaja/app/google-maps-api-key',
      'cdk deploy jaja --outputs-file cdk.out/outputs.json --require-approval never',
    ]);
    expect(stored.get('jaja/app/jwt-secret')).toBe(JWT);
    expect(lines).toContain('Segredo jaja/app/jwt-secret atualizado no Secrets Manager.');
    expect(lines).toContain('Segredo jaja/app/google-maps-api-key criado no Secrets Manager.');
    expect(lines).toContain('API: https://api.jaja.exemplo.com.br  (teste: https://api.jaja.exemplo.com.br/health)');
    expect(lines).toContain('  npm run destroy --workspace=@jaja/infra');
    expect(lines.join('\n')).not.toContain(JWT);
  });

  it('writes no secret when the .env has none', async () => {
    const { runtime, calls } = fakeRuntime();

    await deploy(runtime);

    expect(calls).toEqual(['cdk deploy jaja --outputs-file cdk.out/outputs.json']);
  });

  it('stops before anything when the .env is invalid', async () => {
    const { runtime, calls, lines } = fakeRuntime({ env: { DOMAIN_NAME: '', ENV_SIZE: 'grande' } });

    expect(await deploy(runtime)).toBe(1);
    expect(calls).toEqual([]);
    expect(lines[0]).toMatch(/^ERROR Configuração do ambiente inválida \(2 problema\(s\)\)/);
  });

  it('stops before writing secrets when the credentials are of another account', async () => {
    const { runtime, calls, lines } = fakeRuntime({ env: { JWT_SECRET: JWT }, account: '111111111111' });

    expect(await deploy(runtime)).toBe(1);
    expect(calls).toEqual([]);
    expect(lines).toContain(
      'ERROR As credenciais em uso são da conta 111111111111, mas o .env informa AWS_ACCOUNT_ID=123456789012. Nada foi alterado.',
    );
  });

  it('returns the code of a failed cdk deploy', async () => {
    const { runtime, lines } = fakeRuntime({ cdkCode: 3 });

    expect(await deploy(runtime)).toBe(3);
    expect(lines).toContain('ERROR cdk deploy terminou com código 3.');
  });

  it('shows the warnings of the configuration', async () => {
    const { runtime, lines } = fakeRuntime({ env: { SEED_ON_DEPLOY: 'true' } });

    await deploy(runtime);

    expect(lines[0]).toMatch(/^⚠ SEED_ON_DEPLOY="true"/);
  });

  it('shows INFRA_ENV_FILE in the destroy command when another file is used', async () => {
    const { runtime, lines } = fakeRuntime();
    const withFile = { ...runtime, envFile: join(REPO_ROOT, 'apps/infra/.env.load') };

    await deploy(withFile);

    expect(lines).toContain('  INFRA_ENV_FILE=apps/infra/.env.load npm run destroy --workspace=@jaja/infra');
  });
});

describe('destroy script', () => {
  it('asks for confirmation and destroys nothing when the answer is no', async () => {
    const { runtime, calls, lines } = fakeRuntime({ confirm: false });

    expect(await destroy(runtime)).toBe(0);
    expect(calls).toEqual([
      'confirm Destruir o ambiente jaja (conta 123456789012, região sa-east-1), com banco, broker e dados?',
    ]);
    expect(lines).toContain('Nada foi destruído.');
  });

  it('runs cdk destroy and then deletes both secrets of the deploy script', async () => {
    const { runtime, calls, lines } = fakeRuntime({ confirm: true, existing: ['jaja/app/jwt-secret'] });

    expect(await destroy(runtime)).toBe(0);
    expect(calls.slice(1)).toEqual([
      'cdk destroy jaja --force',
      'delete sa-east-1 jaja/app/jwt-secret',
      'delete sa-east-1 jaja/app/google-maps-api-key',
    ]);
    expect(lines).toContain('Segredo jaja/app/jwt-secret apagado.');
    expect(lines).toContain('Ambiente jaja destruído.');
  });

  it('skips the question with --force', async () => {
    const { runtime, calls } = fakeRuntime();

    await destroy(runtime, ['--force']);

    expect(calls[0]).toBe('cdk destroy jaja --force');
  });

  it('keeps the secrets when cdk destroy fails', async () => {
    const { runtime, calls, lines } = fakeRuntime({ cdkCode: 1, existing: ['jaja/app/jwt-secret'] });

    expect(await destroy(runtime, ['--force'])).toBe(1);
    expect(calls).toEqual(['cdk destroy jaja --force']);
    expect(lines).toContain('ERROR cdk destroy terminou com código 1; os segredos do .env foram mantidos.');
  });

  it('stops when the credentials are of another account', async () => {
    const { runtime, calls } = fakeRuntime({ account: '111111111111' });

    expect(await destroy(runtime, ['--force'])).toBe(1);
    expect(calls).toEqual([]);
  });
});

it('reports the problems of the .env as an InfraConfigError', () => {
  expect(() => loadInfraConfig({})).toThrow(InfraConfigError);
});
