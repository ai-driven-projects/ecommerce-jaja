import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js';

// CORS of the API from `CORS_ORIGIN`: origins separated by commas (e.g.
// `http://localhost:3000,https://jaja.exemplo.com.br`). Only those origins get
// the CORS headers. Empty or missing accepts any origin, as in local
// development.
export function corsOptions(value: string | undefined): CorsOptions {
  const origins = (value ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return origins.length > 0 ? { origin: origins } : {};
}
