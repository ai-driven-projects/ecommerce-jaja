import { relative } from 'node:path';
import { REPO_ROOT, DEFAULT_ENV_FILE } from '../../src/config/env-file';
import { InfraConfigError } from '../../src/config/infra-config';
import type { LoadedInfraConfig } from '../../src/config/infra-config';
import type { ScriptRuntime } from './runtime';

/** Loads the .env and checks the account of the credentials. `undefined`: stop (already reported). */
export async function prepare(runtime: ScriptRuntime): Promise<LoadedInfraConfig | undefined> {
  let loaded: LoadedInfraConfig;
  try {
    loaded = runtime.loadConfig();
  } catch (error) {
    runtime.error(error instanceof InfraConfigError || error instanceof Error ? error.message : String(error));
    return undefined;
  }

  for (const warning of loaded.warnings) runtime.log(`⚠ ${warning}`);

  const { account, region } = loaded.config;
  let current: string;
  try {
    current = await runtime.currentAccount(region);
  } catch (error) {
    runtime.error(
      `Não foi possível identificar as credenciais AWS (${error instanceof Error ? error.message : String(error)}). ` +
        'Configure AWS_PROFILE ou as credenciais e tente de novo.',
    );
    return undefined;
  }
  if (current !== account) {
    runtime.error(
      `As credenciais em uso são da conta ${current}, mas o .env informa AWS_ACCOUNT_ID=${account}. Nada foi alterado.`,
    );
    return undefined;
  }
  return loaded;
}

/** `npm run <script> --workspace=@jaja/infra`, with INFRA_ENV_FILE when it is not the default. */
export function scriptCommand(script: string, envFile: string): string {
  const file = relative(REPO_ROOT, envFile);
  const prefix = file === DEFAULT_ENV_FILE ? '' : `INFRA_ENV_FILE=${file} `;
  return `${prefix}npm run ${script} --workspace=@jaja/infra`;
}
