import 'package:dio/dio.dart';

import '../../core/errors/app_failure.dart';
import '../../core/result.dart';
import '../../modules/cart/errors/cart_errors.dart';
import '../../modules/cart/model/cart_entity.dart';
import '../api/cart_dto.dart';
import '../http/run_request.dart';

/// Cliente do carrinho da conta (`MyCartController`, `/me/cart`), no papel da
/// parte "conta" de `apps/frontend/src/modules/orders/data/cart.api.ts`. Toda
/// resposta é o carrinho inteiro (`CartDetailDTO`). O token vai pelo
/// `AuthInterceptor`.
///
/// Os quatro comandos traduzem a recusa com [mapCartFailure]; [load] e
/// [merge] devolvem a falha HTTP como veio.
final class AccountCartApi {
  AccountCartApi(this._dio);

  final Dio _dio;

  static const _path = '/me/cart';

  /// `GET /me/cart`.
  Future<Result<CartDetail>> load() => _request(() => _dio.get<Object?>(_path));

  /// `POST /me/cart/items` com `{productId, quantity}`.
  Future<Result<CartDetail>> add(String productId, int quantity) => _command(
    () => _dio.post<Object?>(
      '$_path/items',
      data: {'productId': productId, 'quantity': quantity},
    ),
  );

  /// `PUT /me/cart/items/:productId` com `{quantity}`.
  Future<Result<CartDetail>> setQuantity(String productId, int quantity) =>
      _command(
        () => _dio.put<Object?>(
          _itemPath(productId),
          data: {'quantity': quantity},
        ),
      );

  /// `DELETE /me/cart/items/:productId`.
  Future<Result<CartDetail>> remove(String productId) =>
      _command(() => _dio.delete<Object?>(_itemPath(productId)));

  /// `DELETE /me/cart`.
  Future<Result<CartDetail>> clear() =>
      _command(() => _dio.delete<Object?>(_path));

  /// `POST /me/cart/merge` com `{items}`, na ordem do carrinho do aparelho.
  Future<Result<CartDetail>> merge(List<CartItem> items) => _request(
    () => _dio.post<Object?>('$_path/merge', data: encodeCartItems(items)),
  );

  static String _itemPath(String productId) =>
      '$_path/items/${Uri.encodeComponent(productId)}';

  Future<Result<CartDetail>> _request(
    Future<Response<Object?>> Function() send,
  ) => runRequest(send, parseCartDetail);

  Future<Result<CartDetail>> _command(
    Future<Response<Object?>> Function() send,
  ) async {
    return switch (await _request(send)) {
      Ok() && final ok => ok,
      Failure(:final failure) => Failure(mapCartFailure(failure)),
    };
  }
}

/// Traduz a recusa de um comando do carrinho da conta: um
/// [BackendRejectionFailure] com código conhecido ganha o texto e o código do
/// [CartErrorCode], mantendo `statusCode`/`codes`; um [NotFoundFailure] vira
/// "Produto indisponível." (nesses caminhos o `404` só vem de
/// `CART_PRODUCT_NOT_FOUND`/`CART_USER_NOT_FOUND`, e o `mapHttpFailure`
/// descarta os códigos do `404`). As outras falhas passam como vieram.
AppFailure mapCartFailure(AppFailure failure) {
  return switch (failure) {
    BackendRejectionFailure(:final statusCode, :final codes) =>
      switch (cartErrorFromCodes(codes)) {
        final CartErrorCode code => BackendRejectionFailure(
          message: code.message,
          code: code,
          statusCode: statusCode,
          codes: codes,
        ),
        null => failure,
      },
    NotFoundFailure() => NotFoundFailure(
      message: CartErrorCode.productUnavailable.message,
      code: CartErrorCode.productUnavailable,
    ),
    _ => failure,
  };
}
