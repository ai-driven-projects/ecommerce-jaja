import { ORDER_STATUSES, OrderFiltersDTO, OrderStatusFilter } from '@jaja/orders';

// HTTP helpers of `OrderAdminController`. The failures of the admin queries
// are translated by `throwOrderFailure` (`order-http.ts`), as in the customer
// order endpoints.

export const DEFAULT_ORDERS_PAGE = 1;
export const DEFAULT_ORDERS_PAGE_SIZE = 20;
export const MAX_ORDERS_PAGE_SIZE = 100;

// The query string of `GET /orders`: every value arrives as text (or an array
// when repeated), so each one is checked before use.
export type OrderListQuery = {
  page?: unknown;
  pageSize?: unknown;
  status?: unknown;
  search?: unknown;
};

const STATUS_FILTERS: readonly OrderStatusFilter[] = [...ORDER_STATUSES, 'IN_PROGRESS'];

/**
 * Normalizes the query string of the admin listing:
 * - `page` and `pageSize` must be positive integers written only with digits;
 *   anything else falls back to 1 and 20, and `pageSize` is capped at 100;
 * - `status` is kept only when it is exactly one of `ORDER_STATUSES` or
 *   `IN_PROGRESS`; any other value is ignored;
 * - `search` is trimmed, and ignored when empty or not text.
 */
export function toOrderFilters(query: OrderListQuery | undefined): OrderFiltersDTO {
  const raw = query ?? {};
  const filters: OrderFiltersDTO = {
    page: positiveInteger(raw.page, DEFAULT_ORDERS_PAGE),
    pageSize: Math.min(
      positiveInteger(raw.pageSize, DEFAULT_ORDERS_PAGE_SIZE),
      MAX_ORDERS_PAGE_SIZE,
    ),
  };

  if (typeof raw.status === 'string' && isStatusFilter(raw.status)) {
    filters.status = raw.status;
  }
  if (typeof raw.search === 'string' && raw.search.trim()) {
    filters.search = raw.search.trim();
  }
  return filters;
}

function isStatusFilter(value: string): value is OrderStatusFilter {
  return (STATUS_FILTERS as readonly string[]).includes(value);
}

function positiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return fallback;
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : fallback;
}
