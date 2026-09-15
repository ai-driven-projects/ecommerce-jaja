import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { OrderErrors, PlaceOrderInputDTO } from '@jaja/orders';

// HTTP helpers of `MyOrderController`: the body of the confirmation and the
// translation of the order failures.

// The only fields read from the body of `POST /me/orders`.
export type PlaceOrderBody = {
  // Missing or blank uses the name of the user.
  recipientName?: string;
  // Missing or blank resolves to `null`.
  deliveryInstructions?: string;
};

/**
 * Builds the input of `PlaceOrder`. The user always comes from the token, and
 * only `recipientName` and `deliveryInstructions` are read from the body, and
 * only when they are strings (any other type becomes missing). Everything else
 * (`customerId`, `items`, prices, totals, `status`, payment data) is discarded:
 * customer, items and prices are read on the server.
 */
export function toPlaceOrderInput(
  userId: string,
  body: PlaceOrderBody | undefined,
): PlaceOrderInputDTO {
  const raw = (body ?? {}) as Record<string, unknown>;
  return {
    userId,
    recipientName: stringOrUndefined(raw.recipientName),
    deliveryInstructions: stringOrUndefined(raw.deliveryInstructions),
  };
}

export function throwOrderFailure(errors: string[]): never {
  // Value objects may repeat a code; the API exposes each code once.
  const codes = [...new Set(errors)];
  if (codes.includes(OrderErrors.ORDER_NOT_FOUND)) {
    throw new NotFoundException(codes);
  }
  if (codes.includes(OrderErrors.ORDER_ALREADY_EXISTS)) {
    throw new ConflictException(codes);
  }
  // Customer, cart, product and validation failures.
  throw new BadRequestException(codes);
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
