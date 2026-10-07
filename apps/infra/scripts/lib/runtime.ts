import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import {
  CreateSecretCommand,
  DeleteSecretCommand,
  PutSecretValueCommand,
  ResourceExistsException,
  ResourceNotFoundException,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import { INFRA_DIR, readEnvFile, resolveEnvFilePath } from '../../src/config/env-file';
import { loadInfraConfig } from '../../src/config/infra-config';
import type { LoadedInfraConfig } from '../../src/config/infra-config';

/** What the deploy and destroy scripts need from the outside, replaced by fakes in the tests. */
export interface ScriptRuntime {
  /** Path of the .env (for the messages and for the CDK app). */
  readonly envFile: string;
  loadConfig(): LoadedInfraConfig;
  currentAccount(region: string): Promise<string>;
  readonly secrets: SecretsStore;
  /** Runs the CDK CLI in apps/infra and resolves with its exit code. */
  runCdk(args: string[]): Promise<number>;
  confirm(question: string): Promise<boolean>;
  log(message: string): void;
  error(message: string): void;
}

export interface SecretsStore {
  /** Creates the secret or writes a new value. Never logs the value. */
  put(region: string, name: string, value: string): Promise<'created' | 'updated'>;
  /** Deletes without recovery window (a new deploy may reuse the name at once). */
  delete(region: string, name: string): Promise<'deleted' | 'missing'>;
}

export function awsRuntime(): ScriptRuntime {
  const envFile = resolveEnvFilePath(process.env.INFRA_ENV_FILE);
  return {
    envFile,
    loadConfig: () => loadInfraConfig(readEnvFile(envFile)),
    currentAccount: async (region) => {
      const identity = await new STSClient({ region }).send(new GetCallerIdentityCommand({}));
      return identity.Account ?? '';
    },
    secrets: awsSecretsStore(),
    runCdk: (args) => runCdk(args, envFile),
    confirm: async (question) => {
      const prompt = createInterface({ input: process.stdin, output: process.stdout });
      try {
        return /^s(im)?$/i.test((await prompt.question(`${question} (s/N) `)).trim());
      } finally {
        prompt.close();
      }
    },
    log: (message) => console.log(message),
    error: (message) => console.error(message),
  };
}

function awsSecretsStore(): SecretsStore {
  const client = (region: string) => new SecretsManagerClient({ region });
  return {
    async put(region, name, value) {
      try {
        await client(region).send(
          new CreateSecretCommand({ Name: name, SecretString: value, Description: 'Jaja: valor vindo do .env do infra' }),
        );
        return 'created';
      } catch (error) {
        if (!(error instanceof ResourceExistsException)) throw error;
        await client(region).send(new PutSecretValueCommand({ SecretId: name, SecretString: value }));
        return 'updated';
      }
    },
    async delete(region, name) {
      try {
        await client(region).send(new DeleteSecretCommand({ SecretId: name, ForceDeleteWithoutRecovery: true }));
        return 'deleted';
      } catch (error) {
        if (error instanceof ResourceNotFoundException) return 'missing';
        throw error;
      }
    },
  };
}

function runCdk(args: string[], envFile: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['--no-install', 'cdk', ...args], {
      cwd: INFRA_DIR,
      stdio: 'inherit',
      env: { ...process.env, INFRA_ENV_FILE: envFile },
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}
