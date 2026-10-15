import 'package:freezed_annotation/freezed_annotation.dart';

import '../../../core/value_objects/money.dart';
import 'order_number.dart';
import 'order_status.dart';

part 'order_entity.freezed.dart';

/// Linha do pedido como foi fechada (`OrderItemDTO`): nome, unidade e preço
/// copiados do catálogo no momento do pedido. [thumbUrl] é `null` sem foto.
@freezed
abstract class OrderItem with _$OrderItem {
  const factory OrderItem({
    required String productId,
    required String name,
    required String unit,
    required String? thumbUrl,
    required Money unitPrice,
    required int quantity,
    required Money lineTotal,
  }) = _OrderItem;
}

/// Endereço copiado do cadastro ao fechar o pedido
/// (`OrderDeliveryAddressDTO`), sem a localização.
@freezed
abstract class OrderDeliveryAddress with _$OrderDeliveryAddress {
  const factory OrderDeliveryAddress({
    required String zipCode,
    required String street,
    required String number,
    required String? complement,
    required String neighborhood,
    required String city,
    required String state,
  }) = _OrderDeliveryAddress;
}

/// Pedido completo como `GET /me/orders/:id` o devolve (`OrderDetailDTO` em
/// `modules/orders/src/order/dto/order.dto.ts`), sem o `customerId`, que a
/// tela não usa. As datas ficam em UTC; a data de um passo é `null` enquanto
/// o pedido não chegou a ele.
@freezed
abstract class OrderDetail with _$OrderDetail {
  const factory OrderDetail({
    required String id,
    required OrderStatus status,
    required List<OrderItem> items,
    required OrderDeliveryAddress deliveryAddress,
    required String recipientName,
    required String? deliveryInstructions,
    required int itemCount,
    required Money subtotal,
    required Money deliveryFee,
    required Money total,
    required DateTime placedAt,
    required DateTime? paymentApprovedAt,
    required DateTime? pickingStartedAt,
    required DateTime? outForDeliveryAt,
    required DateTime? deliveredAt,
  }) = _OrderDetail;

  const OrderDetail._();

  /// Número exibido ao cliente ([orderNumberOf]).
  String get number => orderNumberOf(id);

  /// Data do passo [step], o campo de `ORDER_STEPS[].dateKey` em
  /// `apps/frontend/src/modules/orders/data/order-status.util.ts`.
  DateTime? dateOf(OrderStatus step) => switch (step) {
    OrderStatus.placed => placedAt,
    OrderStatus.paymentApproved => paymentApprovedAt,
    OrderStatus.picking => pickingStartedAt,
    OrderStatus.outForDelivery => outForDeliveryAt,
    OrderStatus.delivered => deliveredAt,
  };
}
