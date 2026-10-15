/// Situação do acompanhamento ao vivo do pedido: os estados de
/// `EventStreamStatus` (`apps/frontend/src/shared/utils/event-stream.util.ts`)
/// mais o [off] de `MyOrderLiveStatus`.
///
/// [off]: sem stream (pedido entregue, tela fora da vista ou descartada).
/// [connecting]: abrindo a primeira conexão. [live]: conexão aberta.
/// [reconnecting]: a conexão caiu e uma nova tentativa vem depois da espera.
/// [closed]: o servidor recusou (`401`, `403` ou `404`); não há nova tentativa.
enum OrderLiveStatus { off, connecting, live, reconnecting, closed }
