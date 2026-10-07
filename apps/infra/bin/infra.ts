// Entry of the CDK app (`cdk.json`). Reads the .env of the environment
// (INFRA_ENV_FILE or apps/infra/.env), validates it and creates the stack
// `<ENV_NAME>` in the account and region of the .env: the CDK refuses to
// operate with credentials of another account.
import { App } from 'aws-cdk-lib';
import { readEnvFile, resolveEnvFilePath } from '../src/config/env-file';
import { loadInfraConfig } from '../src/config/infra-config';
import { JajaStack } from '../src/jaja-stack';

const { config, warnings } = loadInfraConfig(readEnvFile(resolveEnvFilePath(process.env.INFRA_ENV_FILE)));
for (const warning of warnings) console.warn(`⚠ ${warning}`);

const app = new App();
new JajaStack(app, config.envName, {
  env: { account: config.account, region: config.region },
  description: `Jaja: ambiente efêmero do backend (${config.size}) - ${config.apiDomainName}`,
  config,
});
