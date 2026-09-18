/**
 * The data each simulated external system (the payment gateway, the store, the
 * delivery) reports when it concludes its step of the order.
 *
 * Everything is derived from the id of the order and nothing is random: the
 * tests check exact values, the log of the cycle stays readable and
 * reprocessing a message produces the same data. In a real system each of these
 * would come from the service itself.
 */

// The first 8 characters of the id, in upper case: short enough for a log line
// and enough to tell the orders apart.
function shortId(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}

// Id of the transaction at the simulated payment gateway.
export function simulatedTransactionId(orderId: string): string {
  return `TX-${shortId(orderId)}`;
}

// Id of the picking list at the simulated store.
export function simulatedPickingListId(orderId: string): string {
  return `SEP-${shortId(orderId)}`;
}

// Code the customer would use to follow the simulated delivery.
export function simulatedTrackingCode(orderId: string): string {
  return `JAJA-${shortId(orderId)}`;
}

// The only courier of the simulated delivery.
export const SIMULATED_COURIER_NAME = 'Entregador Simulado';

// The simulated delivery always promises the order this many minutes ahead.
export const SIMULATED_DELIVERY_MINUTES = 15;

// When the simulated delivery expects to hand the order to the customer.
export function simulatedEstimatedDeliveryAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + SIMULATED_DELIVERY_MINUTES * 60_000);
}
