// Entrypoint of the backend image. Builds `DATABASE_URL`/`RABBITMQ_URL` from
// their parts when empty (see `compose-env.mjs`) and runs a command:
// - `serve` (default): the API, in this same process (signals reach Nest);
// - `migrate`: `prisma migrate deploy` and, with `SEED_ON_DEPLOY="true"`, the
//   seed. Exits with the code of the first step that fails.
// Never prints the URLs: they carry the passwords.
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { composeEnv, databaseUrlFrom } from './compose-env.mjs';

const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
Object.assign(process.env, composeEnv(process.env));

const command = process.argv[2] ?? 'serve';

if (command === 'serve') {
  await import(resolve(backendDir, 'dist/main.js'));
} else if (command === 'migrate') {
  migrate();
} else {
  console.error(`Unknown command "${command}": use serve or migrate`);
  process.exit(2);
}

function migrate() {
  // The schema engine of Prisma reads its own TLS parameters.
  const prismaUrl = databaseUrlFrom(process.env, 'prisma') ?? process.env.DATABASE_URL;
  run('prisma migrate deploy', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: prismaUrl });

  if ((process.env.SEED_ON_DEPLOY ?? '').trim().toLowerCase() === 'true') {
    run('seed', ['prisma', 'db', 'seed'], {});
  } else {
    console.log('[migrate] SEED_ON_DEPLOY is not "true": seed skipped');
  }
  console.log('[migrate] done');
}

function run(label, args, extraEnv) {
  console.log(`[migrate] ${label}...`);
  const result = spawnSync('npx', ['--no-install', ...args], {
    cwd: backendDir,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) {
    console.error(`[migrate] ${label} failed (exit ${result.status ?? result.signal})`);
    process.exit(result.status ?? 1);
  }
}
