import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/infra/http/api_client.dart';
import 'package:mobile/infra/order/api_order_repository.dart';
import 'package:mobile/modules/order/errors/order_errors.dart';
import 'package:mobile/modules/order/model/placed_order.dart';

import '../api/support/order_json.dart';
import '../http/support/fake_http_client_adapter.dart';

void main() {
  late FakeHttpClientAdapter adapter;
  late ApiOrderRepository repository;

  setUp(() {
    adapter = FakeHttpClientAdapter();
    final dio = createApiClient(Uri.parse('http://localhost:4000'))
      ..httpClientAdapter = adapter;
    repository = ApiOrderRepository(dio);
  });

  Future<Result<PlacedOrder>> place({
    String recipientName = 'Maria Souza',
    String deliveryInstructions = 'Portão azul',
  }) => repository.placeOrder(
    recipientName: recipientName,
    deliveryInstructions: deliveryInstructions,
  );

  AppFailure failureOf<T>(Result<T> result) => (result as Failure<T>).failure;

  group('placeOrder', () {
    test('faz POST /me/orders com quem recebe e as instruções', () async {
      adapter.enqueueResponse(statusCode: 201, body: placedOrderJson);

      await place(recipientName: ' Maria ', deliveryInstructions: '');

      final request = adapter.requests.single;
      expect(request.method, 'POST');
      expect(request.path, '/me/orders');
      expect(request.data, {
        'recipientName': ' Maria ',
        'deliveryInstructions': '',
      });
    });

    test('201 vira Ok(PlacedOrder) com o id do pedido', () async {
      adapter.enqueueResponse(statusCode: 201, body: placedOrderJson);

      final result = await place();

      expect(result, isA<Ok<PlacedOrder>>());
      expect(
        (result as Ok<PlacedOrder>).value,
        const PlacedOrder(placedOrderId),
      );
    });

    test('201 sem id vira falha inesperada', () async {
      adapter.enqueueResponse(statusCode: 201, body: placedOrderWithout('id'));

      expect(failureOf(await place()), isA<UnexpectedFailure>());
    });
  });

  group('recusas', () {
    test('ORDER_CUSTOMER_INACTIVE vira o texto do web e mantém statusCode e '
        'codes', () async {
      adapter.enqueueResponse(statusCode: 400, body: customerInactiveJson);

      final failure = failureOf(await place());

      expect(
        failure,
        isA<BackendRejectionFailure>()
            .having(
              (f) => f.message,
              'message',
              'Seu cadastro está inativo. Fale com o atendimento.',
            )
            .having((f) => f.code, 'code', OrderErrorCode.customerInactive)
            .having((f) => f.statusCode, 'statusCode', 400)
            .having((f) => f.codes, 'codes', ['ORDER_CUSTOMER_INACTIVE']),
      );
    });

    test('cada recusa conhecida vira o texto do seu código', () async {
      final cases = {
        customerRequiredJson: OrderErrorCode.customerRequired,
        cartHasUnavailableItemsJson: OrderErrorCode.cartHasUnavailableItems,
        textTooShortJson: OrderErrorCode.textTooShort,
      };
      for (final MapEntry(key: body, value: code) in cases.entries) {
        adapter.enqueueResponse(statusCode: 400, body: body);

        final failure = failureOf(await place());

        expect(failure, isA<BackendRejectionFailure>());
        expect(failure.code, code);
        expect(failure.message, code.message);
      }
    });

    test('código desconhecido mantém a mensagem genérica', () async {
      adapter.enqueueResponse(statusCode: 400, body: unknownOrderRejectionJson);

      final failure = failureOf(await place());

      expect(
        failure,
        isA<BackendRejectionFailure>()
            .having(
              (f) => f.message,
              'message',
              'Não foi possível concluir. Tente novamente.',
            )
            .having((f) => f.code, 'code', HttpFailureCode.rejected)
            .having((f) => f.statusCode, 'statusCode', 400)
            .having((f) => f.codes, 'codes', ['ALGO_NOVO']),
      );
    });

    test('401 mantém a falha de sessão', () async {
      adapter.enqueueResponse(
        statusCode: 401,
        body: orderRejectionJson(401, []),
      );

      expect(failureOf(await place()), isA<SessionFailure>());
    });

    test('500 mantém a falha do servidor', () async {
      adapter.enqueueResponse(statusCode: 500, body: 'Internal Server Error');

      final failure = failureOf(await place());

      expect(failure, isA<ServerFailure>());
      expect(
        failure.message,
        'O servidor está indisponível no momento. Tente novamente em instantes.',
      );
    });

    test('falha de rede mantém a mensagem de rede', () async {
      adapter.enqueueError(DioExceptionType.connectionError);

      final failure = failureOf(await place());

      expect(failure, isA<NetworkFailure>());
      expect(
        failure.message,
        'Não foi possível falar com o servidor. Tente novamente.',
      );
    });
  });
}
