// `npm run destroy --workspace=@jaja/infra [-- --force]`
// Destroys the whole environment of the .env: `cdk destroy` of the stack and,
// only after it succeeds, the secrets written by the deploy script. Asks for
// confirmation unless `--force` is given.
import { appSecretName } from '../src/config/infra-config';
import { prepare } from './lib/common';
import { awsRuntime } from './lib/runtime';
import type { ScriptRuntime } from './lib/runtime';

export async function destroy(runtime: ScriptRuntime, args: string[] = []): Promise<number> {
  const loaded = await prepare(runtime);
  if (!loaded) return 1;
  const { config } = loaded;

  const force = args.includes('--force');
  const cdkArgs = args.filter((arg) => arg !== '--force');
  if (!force) {
    const confirmed = await runtime.confirm(
      `Destruir o ambiente ${config.envName} (conta ${config.account}, região ${config.region}), com banco, broker e dados?`,
    );
    if (!confirmed) {
      runtime.log('Nada foi destruído.');
      return 0;
    }
  }

  const code = await runtime.runCdk(['destroy', config.envName, '--force', ...cdkArgs]);
  if (code !== 0) {
    runtime.error(`cdk destroy terminou com código ${code}; os segredos do .env foram mantidos.`);
    return code;
  }

  // Both names, whatever the .env has now: it may have changed since the deploy.
  for (const key of ['jwt-secret', 'google-maps-api-key'] as const) {
    const name = appSecretName(config.envName, key);
    if ((await runtime.secrets.delete(config.region, name)) === 'deleted') {
      runtime.log(`Segredo ${name} apagado.`);
    }
  }
  runtime.log(`Ambiente ${config.envName} destruído.`);
  return 0;
}

if (require.main === module) {
  destroy(awsRuntime(), process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    },
  );
}
