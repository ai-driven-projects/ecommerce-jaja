import 'order_status.dart';

// Regras dos passos copiadas de `orderStepState` e `isOrderFinished`
// (`apps/frontend/src/modules/orders/data/order-status.util.ts`). Os passos
// são os valores de `OrderStatus`, na ordem.

/// Situação de um passo na linha do tempo do pedido.
enum OrderStepState { done, current, pending }

/// Situação do passo [step] para um pedido em [status], derivada só do
/// status: até o atual, inclusive, [OrderStepState.done]; o seguinte,
/// [OrderStepState.current] enquanto o pedido não foi entregue; o resto,
/// [OrderStepState.pending].
OrderStepState orderStepState(OrderStatus status, OrderStatus step) {
  if (step.index <= status.index) return OrderStepState.done;
  if (step.index == status.index + 1 && !isOrderFinished(status)) {
    return OrderStepState.current;
  }
  return OrderStepState.pending;
}

/// `true` quando o pedido chegou ao último passo (entregue) e não muda mais.
bool isOrderFinished(OrderStatus status) => status == OrderStatus.delivered;
