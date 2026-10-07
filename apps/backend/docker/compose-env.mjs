// Builds the connection URLs of the backend from the parts injected by the
// container platform (ECS hands each secret field as its own variable, it does
// not compose strings). Pure functions, used by `entrypoint.mjs` and tested in
// `test/docker/compose-env.spec.ts`. The application keeps reading only
// `DATABASE_URL` and `RABBITMQ_URL`: it never knows where they came from.

const DEFAULT_DB_CA_FILE = '/app/certs/rds-global-bundle.pem';

/**
 * `DATABASE_URL` from `DB_HOST`, `DB_PORT` (default 5432), `DB_NAME`, `DB_USER`
 * and `DB_PASSWORD` (both URL-encoded). With `DB_SSL="true"` the connection
 * uses TLS checking the certificate against `DB_CA_FILE` (default: the RDS
 * bundle of the image), in the dialect of each client:
 * - `pg` (the application and the seed): `sslmode=verify-full`, with the CA of
 *   `NODE_EXTRA_CA_CERTS`;
 * - `prisma` (the migrations, run by the Prisma schema engine):
 *   `sslmode=require&sslcert=<CA>`, its own parameters.
 *
 * @param {Record<string, string | undefined>} env
 * @param {'pg' | 'prisma'} [client]
 * @returns {string | undefined} undefined when a required part is missing
 */
export function databaseUrlFrom(env, client = 'pg') {
  const host = text(env.DB_HOST);
  const name = text(env.DB_NAME);
  const user = text(env.DB_USER);
  const password = env.DB_PASSWORD ?? '';
  if (!host || !name || !user) return undefined;

  const port = text(env.DB_PORT) || '5432';
  const auth = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
  const params = new URLSearchParams({ schema: 'public' });
  if (text(env.DB_SSL).toLowerCase() === 'true') {
    if (client === 'prisma') {
      params.set('sslmode', 'require');
      params.set('sslcert', text(env.DB_CA_FILE) || DEFAULT_DB_CA_FILE);
    } else {
      params.set('sslmode', 'verify-full');
    }
  }
  return `postgresql://${auth}@${host}:${port}/${encodeURIComponent(name)}?${params}`;
}

/**
 * `RABBITMQ_URL` from `RABBITMQ_ENDPOINT` (e.g. `amqps://b-1234.mq.sa-east-1.amazonaws.com:5671`),
 * `RABBITMQ_USER` and `RABBITMQ_PASSWORD` (both URL-encoded). Amazon MQ lists its
 * endpoints as `amqp+ssl://`, which becomes `amqps://` (the scheme of amqplib).
 *
 * @param {Record<string, string | undefined>} env
 * @returns {string | undefined} undefined when a required part is missing
 */
export function rabbitMqUrlFrom(env) {
  const endpoint = text(env.RABBITMQ_ENDPOINT);
  const user = text(env.RABBITMQ_USER);
  if (!endpoint || !user) return undefined;

  const url = new URL(endpoint.replace(/^amqp\+ssl:\/\//i, 'amqps://'));
  url.username = encodeURIComponent(user);
  url.password = encodeURIComponent(env.RABBITMQ_PASSWORD ?? '');
  return url.toString().replace(/\/$/, '');
}

/**
 * The variables to add to the environment: each URL that is empty and can be
 * built from its parts. A URL already given is never replaced.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {Record<string, string>}
 */
export function composeEnv(env) {
  const composed = {};
  if (!text(env.DATABASE_URL)) {
    const databaseUrl = databaseUrlFrom(env, 'pg');
    if (databaseUrl) composed.DATABASE_URL = databaseUrl;
  }
  if (!text(env.RABBITMQ_URL)) {
    const rabbitMqUrl = rabbitMqUrlFrom(env);
    if (rabbitMqUrl) composed.RABBITMQ_URL = rabbitMqUrl;
  }
  return composed;
}

function text(value) {
  return (value ?? '').trim();
}
