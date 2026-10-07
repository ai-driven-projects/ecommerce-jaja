import { BadRequestException } from '@nestjs/common';
import { PlanLoadTestOrderInputDTO } from '@jaja/dev';

// HTTP helpers of `LoadTestController`.

// The only field read from the body of `POST /dev/load-test/orders`.
export type LoadTestOrderBody = {
  runId?: string;
};

// Answer of `POST /dev/load-test/orders`: the order placed and how long the
// server took (plan + `PlaceOrder`, in ms), so the screen can tell the time
// spent inside the API from the time spent on the network and in the queue of
// connections.
export type LoadTestOrderPlacedDTO = {
  runId: string;
  orderId: string;
  serverMs: number;
};

// Answer of `GET /dev/load-test/pool`: how many products and customers the
// orders of a run are drawn from.
export type LoadTestPoolSummaryDTO = {
  products: number;
  customers: number;
};

// Only `runId`, and only when it is text: any other type becomes missing and
// fails as `LOAD_TEST_RUN_ID_INVALID`.
export function toPlanInput(body: LoadTestOrderBody | undefined): PlanLoadTestOrderInputDTO {
  const raw = (body ?? {}) as Record<string, unknown>;
  return { runId: typeof raw.runId === 'string' ? raw.runId : '' };
}

// The failures of the plan (run id, empty pool) are all 400.
export function throwLoadTestFailure(errors: string[]): never {
  throw new BadRequestException([...new Set(errors)]);
}
