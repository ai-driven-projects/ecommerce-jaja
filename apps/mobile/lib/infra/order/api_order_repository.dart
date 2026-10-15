import 'package:dio/dio.dart';

import '../../core/errors/app_failure.dart';
import '../../core/result.dart';
import '../../modules/order/errors/order_errors.dart';
import '../../modules/order/model/placed_order.dart';
import '../../modules/order/provider/order_repository.dart';
import '../api/order_dto.dart';
import '../http/run_request.dart';

/// [OrderRepository] sobre `MyOrderController` (`/me/orders`), no papel de
/// `apps/frontend/src/modules/orders/data/order.api.ts`. O token vai pelo
/// `AuthInterceptor`. As recusas são traduzidas por [mapOrderFailure].
final class ApiOrderRepository implements OrderRepository {
  ApiOrderRepository(this._dio);

  final Dio _dio;

  static const _path = '/me/orders';

  /// `POST /me/orders` com o corpo de [encodePlaceOrder].
  @override
  Future<Result<PlacedOrder>> placeOrder({
    required String recipientName,
    required String deliveryInstructions,
  }) async {
    return switch (await runRequest(
      () => _dio.post<Object?>(
        _path,
        data: encodePlaceOrder(recipientName, deliveryInstructions),
      ),
      parsePlacedOrder,
    )) {
      Ok() && final ok => ok,
      Failure(:final failure) => Failure(mapOrderFailure(failure)),
    };
  }
}

/// Traduz a recusa do fechamento: um [BackendRejectionFailure] com código
/// conhecido ganha o texto e o código do [OrderErrorCode], mantendo
/// `statusCode`/`codes` (o checkout lê os `codes` para saber se a recusa é do
/// cadastro). As outras falhas passam como vieram, inclusive a recusa sem
/// código conhecido, a sessão expirada, o servidor fora e a rede.
AppFailure mapOrderFailure(AppFailure failure) {
  return switch (failure) {
    BackendRejectionFailure(:final statusCode, :final codes) =>
      switch (orderErrorFromCodes(codes)) {
        final OrderErrorCode code => BackendRejectionFailure(
          message: code.message,
          code: code,
          statusCode: statusCode,
          codes: codes,
        ),
        null => failure,
      },
    _ => failure,
  };
}
