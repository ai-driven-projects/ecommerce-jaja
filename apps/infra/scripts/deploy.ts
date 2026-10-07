// `npm run deploy --workspace=@jaja/infra [-- <cdk deploy options>]`
// 1. validates the .env (every problem at once) and shows the warnings;
// 2. checks that the credentials are of AWS_ACCOUNT_ID (nothing is written otherwise);
// 3. writes the secrets that came from the .env to Secrets Manager (never to the template);
// 4. runs `cdk deploy` and shows the URL of the API and how to destroy the environment.
import { appSecretName } from '../src/config/infra-config';
import { prepare, scriptCommand } from './lib/common';
import { awsRuntime } from './lib/runtime';
import type { ScriptRuntime } from './lib/runtime';

export async function deploy(runtime: ScriptRuntime, cdkArgs: string[] = []): Promise<number> {
  const loaded = await prepare(runtime);
  if (!loaded) return 1;
  const { config, secrets } = loaded;

  const values: [string, string | undefined][] = [
    [appSecretName(config.envName, 'jwt-secret'), secrets.jwtSecret],
    [appSecretName(config.envName, 'google-maps-api-key'), secrets.googleMapsApiKey],
  ];
  for (const [name, value] of values) {
    if (!value) continue;
    const result = await runtime.secrets.put(config.region, name, value);
    runtime.log(`Segredo ${name} ${result === 'created' ? 'criado' : 'atualizado'} no Secrets Manager.`);
  }

  runtime.log(
    `Deploy de ${config.envName} (${config.size}) na conta ${config.account}, região ${config.region}. ` +
      'Na primeira vez leva de 20 a 45 minutos.',
  );
  const code = await runtime.runCdk(['deploy', config.envName, '--outputs-file', 'cdk.out/outputs.json', ...cdkArgs]);
  if (code !== 0) {
    runtime.error(`cdk deploy terminou com código ${code}.`);
    return code;
  }

  runtime.log('');
  runtime.log(`API: https://${config.apiDomainName}  (teste: https://${config.apiDomainName}/health)`);
  runtime.log('O ambiente é cobrado por hora enquanto existir. Para destruir tudo:');
  runtime.log(`  ${scriptCommand('destroy', runtime.envFile)}`);
  return 0;
}

if (require.main === module) {
  deploy(awsRuntime(), process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    },
  );
}
