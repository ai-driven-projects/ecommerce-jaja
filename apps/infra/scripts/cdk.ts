// `npm run synth|diff --workspace=@jaja/infra [-- <cdk options>]`: validates
// the .env and runs `cdk synth` or `cdk diff` on the stack of the environment.
// Neither writes anything to the account (diff only reads it).
import { readEnvFile, resolveEnvFilePath } from '../src/config/env-file';
import { loadInfraConfig } from '../src/config/infra-config';
import { awsRuntime } from './lib/runtime';

async function main(): Promise<number> {
  const [command, ...args] = process.argv.slice(2);
  if (command !== 'synth' && command !== 'diff') {
    console.error('Uso: tsx scripts/cdk.ts synth|diff [opções do cdk]');
    return 2;
  }
  const { config, warnings } = loadInfraConfig(readEnvFile(resolveEnvFilePath(process.env.INFRA_ENV_FILE)));
  for (const warning of warnings) console.log(`⚠ ${warning}`);
  return awsRuntime().runCdk([command, config.envName, ...args]);
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
