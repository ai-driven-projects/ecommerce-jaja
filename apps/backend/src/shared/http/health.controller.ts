import { Controller, Get } from '@nestjs/common';

export interface HealthResponse {
  readonly status: 'ok';
}

// Liveness of the process, public, for the load balancer and whoever operates
// the environment. It never queries the database nor the broker: a broker that
// is down for a moment must not take every instance out of the balancer (the
// backend keeps answering HTTP and the events wait in the outbox).
@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return { status: 'ok' };
  }
}
