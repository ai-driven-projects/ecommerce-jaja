import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/infra/cart/account_cart_api.dart';
import 'package:mobile/infra/http/api_client.dart';
import 'package:mobile/modules/cart/errors/cart_errors.dart';
import 'package:mobile/modules/cart/model/cart_entity.dart';

import '../api/support/cart_json.dart';
import '../http/support/fake_http_client_adapter.dart';

const _a = '4b7a2f10-3c5e-4d8a-9e21-7f6b1c2d3e20';
const _b = '4b7a2f10-3c5e-4d8a-9e21-7f6b1c2d3e21';

void main() {
  late FakeHttpClientAdapter adapter;
  late AccountCartApi api;

  setUp(() {
    adapter = FakeHttpClientAdapter();
    final dio = createApiClient(Uri.parse('http://localhost:4000'))
      ..httpClientAdapter = adapter;
    api = AccountCartApi(dio);
  });

  CartDetail valueOf(Result<CartDetail> result) =>
      (result as Ok<CartDetail>).value;

  AppFailure failureOf(Result<CartDetail> result) =>
      (result as Failure<CartDetail>).failure;

  RequestOptions lastRequest() => adapter.requests.single;

  group('requisições', () {
    test('load faz GET /me/cart sem corpo e lê o carrinho', () async {
      adapter.enqueueResponse(body: cartPreviewJson);

      final detail = valueOf(await api.load());

      expect(lastRequest().method, 'GET');
      expect(lastRequest().path, '/me/cart');
      expect(lastRequest().data, isNull);
      expect(detail.lines.map((line) => line.productId), [_a, _b]);
      expect(detail.itemCount, 3);
      expect(detail.total.cents, 3070);
      expect(detail.hasUnavailableItems, isTrue);
    });

    test('add faz POST /me/cart/items com {productId, quantity}', () async {
      adapter.enqueueResponse(body: previewWithLine(canetaLineJson));

      final detail = valueOf(await api.add(_a, 2));

      expect(lastRequest().method, 'POST');
      expect(lastRequest().path, '/me/cart/items');
      expect(lastRequest().data, {'productId': _a, 'quantity': 2});
      expect(detail.lines.single.productId, _a);
    });

    test('setQuantity faz PUT /me/cart/items/:id com {quantity}', () async {
      adapter.enqueueResponse(body: previewWithLine(canetaLineJson));

      valueOf(await api.setQuantity(_a, 5));

      expect(lastRequest().method, 'PUT');
      expect(lastRequest().path, '/me/cart/items/$_a');
      expect(lastRequest().data, {'quantity': 5});
    });

    test('remove faz DELETE /me/cart/items/:id sem corpo', () async {
      adapter.enqueueResponse(body: emptyCartPreviewJson);

      final detail = valueOf(await api.remove(_a));

      expect(lastRequest().method, 'DELETE');
      expect(lastRequest().path, '/me/cart/items/$_a');
      expect(lastRequest().data, isNull);
      expect(detail, CartDetail.empty());
    });

    test('clear faz DELETE /me/cart sem corpo', () async {
      adapter.enqueueResponse(body: emptyCartPreviewJson);

      valueOf(await api.clear());

      expect(lastRequest().method, 'DELETE');
      expect(lastRequest().path, '/me/cart');
      expect(lastRequest().data, isNull);
    });

    test('merge faz POST /me/cart/merge com {items}, na ordem', () async {
      adapter.enqueueResponse(body: cartPreviewJson);

      valueOf(
        await api.merge(const [
          CartItem(productId: _b, quantity: 1),
          CartItem(productId: _a, quantity: 2),
        ]),
      );

      expect(lastRequest().method, 'POST');
      expect(lastRequest().path, '/me/cart/merge');
      expect(lastRequest().data, {
        'items': [
          {'productId': _b, 'quantity': 1},
          {'productId': _a, 'quantity': 2},
        ],
      });
    });

    test('id com caractere especial sai codificado no caminho', () async {
      adapter
        ..enqueueResponse(body: emptyCartPreviewJson)
        ..enqueueResponse(body: emptyCartPreviewJson);

      await api.setQuantity('a b/c?d', 1);
      await api.remove('a b/c?d');

      expect(adapter.requests.map((request) => request.path), [
        '/me/cart/items/a%20b%2Fc%3Fd',
        '/me/cart/items/a%20b%2Fc%3Fd',
      ]);
    });

    test('corpo fora do formato vira falha inesperada', () async {
      adapter.enqueueResponse(body: previewWithout('lines'));

      expect(failureOf(await api.load()), isA<UnexpectedFailure>());
    });
  });

  group('falhas dos comandos', () {
    test('400 CART_ITEM_QUANTITY_EXCEEDED ganha o texto do limite', () async {
      adapter.enqueueResponse(statusCode: 400, body: quantityExceededJson);

      final failure = failureOf(await api.add(_a, 1));

      expect(
        failure,
        isA<BackendRejectionFailure>()
            .having(
              (f) => f.message,
              'message',
              'Limite de 99 unidades por produto.',
            )
            .having((f) => f.code, 'code', CartErrorCode.quantityExceeded)
            .having((f) => f.statusCode, 'statusCode', 400)
            .having((f) => f.codes, 'codes', ['CART_ITEM_QUANTITY_EXCEEDED']),
      );
    });

    test('cada CART_* de 400 vira o texto do seu código', () async {
      final cases = {
        itemsLimitExceededJson: CartErrorCode.itemsLimitExceeded,
        quantityInvalidJson: CartErrorCode.quantityInvalid,
      };
      for (final MapEntry(key: body, value: code) in cases.entries) {
        adapter.enqueueResponse(statusCode: 400, body: body);

        final failure = failureOf(await api.setQuantity(_a, 3));

        expect(failure.code, code);
        expect(failure.message, code.message);
      }
    });

    test('404 vira "Produto indisponível." em todos os comandos', () async {
      final commands = <Future<Result<CartDetail>> Function()>[
        () => api.add(_a, 1),
        () => api.setQuantity(_a, 2),
        () => api.remove(_a),
        () => api.clear(),
      ];
      for (final command in commands) {
        adapter.enqueueResponse(statusCode: 404, body: productNotFoundJson);

        final failure = failureOf(await command());

        expect(failure, isA<NotFoundFailure>());
        expect(failure.message, 'Produto indisponível.');
        expect(failure.code, CartErrorCode.productUnavailable);
      }
    });

    test('código desconhecido mantém a mensagem genérica', () async {
      adapter.enqueueResponse(statusCode: 400, body: unknownRejectionJson);

      final failure = failureOf(await api.remove(_a));

      expect(
        failure,
        isA<BackendRejectionFailure>()
            .having(
              (f) => f.message,
              'message',
              'Não foi possível concluir. Tente novamente.',
            )
            .having((f) => f.code, 'code', HttpFailureCode.rejected)
            .having((f) => f.codes, 'codes', ['ALGO_NOVO']),
      );
    });

    test('500 mantém a falha do servidor', () async {
      adapter.enqueueResponse(statusCode: 500, body: 'Internal Server Error');

      final failure = failureOf(await api.add(_a, 1));

      expect(failure, isA<ServerFailure>());
      expect(
        failure.message,
        'O servidor está indisponível no momento. Tente novamente em instantes.',
      );
    });

    test('falha de rede mantém a mensagem de rede', () async {
      adapter.enqueueError(DioExceptionType.connectionError);

      final failure = failureOf(await api.setQuantity(_a, 2));

      expect(failure, isA<NetworkFailure>());
      expect(
        failure.message,
        'Não foi possível falar com o servidor. Tente novamente.',
      );
    });

    test('401 mantém a falha de sessão', () async {
      adapter.enqueueResponse(
        statusCode: 401,
        body: cartRejectionJson(401, []),
      );

      expect(failureOf(await api.add(_a, 1)), isA<SessionFailure>());
    });
  });

  group('falhas de load e merge', () {
    test('load com 404 não é traduzido', () async {
      adapter.enqueueResponse(statusCode: 404, body: productNotFoundJson);

      final failure = failureOf(await api.load());

      expect(failure, isA<NotFoundFailure>());
      expect(failure.code, HttpFailureCode.notFound);
      expect(failure.message, isNot('Produto indisponível.'));
    });

    test('merge com recusa CART_* não é traduzido', () async {
      adapter.enqueueResponse(statusCode: 400, body: quantityExceededJson);

      final failure = failureOf(
        await api.merge(const [CartItem(productId: _a, quantity: 1)]),
      );

      expect(failure.code, HttpFailureCode.rejected);
    });
  });
}
