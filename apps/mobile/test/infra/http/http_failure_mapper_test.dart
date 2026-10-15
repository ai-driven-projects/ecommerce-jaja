import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/infra/http/http_failure_mapper.dart';

const _networkMessage =
    'Não foi possível falar com o servidor. Tente novamente.';
const _htmlBody = '<html><body><h1>503 Service Unavailable</h1></body></html>';

final _request = RequestOptions(path: '/storefront/stores');

DioException _error(DioExceptionType type) =>
    DioException(requestOptions: _request, type: type);

DioException _badResponse(int? statusCode, [Object? data]) => DioException(
  requestOptions: _request,
  type: DioExceptionType.badResponse,
  response: Response<Object?>(
    requestOptions: _request,
    statusCode: statusCode,
    data: data,
  ),
);

Map<String, Object?> _apiError(int statusCode, Object? message) => {
  'statusCode': statusCode,
  'error': 'Bad Request',
  'message': message,
};

void main() {
  group('mapHttpFailure: rede', () {
    for (final type in [
      DioExceptionType.connectionError,
      DioExceptionType.badCertificate,
    ]) {
      test('$type vira falha de rede sem conexão', () {
        final failure = mapHttpFailure(_error(type));

        expect(failure, isA<NetworkFailure>());
        expect(failure.code, HttpFailureCode.noConnection);
        expect(failure.message, _networkMessage);
      });
    }

    for (final type in [
      DioExceptionType.connectionTimeout,
      DioExceptionType.sendTimeout,
      DioExceptionType.receiveTimeout,
      DioExceptionType.transformTimeout,
    ]) {
      test('$type vira falha de rede por tempo esgotado', () {
        final failure = mapHttpFailure(_error(type));

        expect(failure, isA<NetworkFailure>());
        expect(failure.code, HttpFailureCode.timeout);
        expect(failure.message, _networkMessage);
      });
    }
  });

  group('mapHttpFailure: status', () {
    test('401 vira falha de sessão', () {
      final failure = mapHttpFailure(_badResponse(401));

      expect(failure, isA<SessionFailure>());
      expect(failure.code, HttpFailureCode.sessionExpired);
      expect(failure.message, 'Sua sessão expirou. Entre de novo.');
    });

    test('404 vira não encontrado', () {
      final failure = mapHttpFailure(_badResponse(404));

      expect(failure, isA<NotFoundFailure>());
      expect(failure.code, HttpFailureCode.notFound);
      expect(failure.message, 'Não encontramos o que você procurou.');
    });

    test('400 com lista de códigos vira recusa com a ordem preservada', () {
      final failure = mapHttpFailure(
        _badResponse(
          400,
          _apiError(400, [
            'CART_ITEMS_LIMIT_EXCEEDED',
            'CART_ITEM_QUANTITY_EXCEEDED',
          ]),
        ),
      );

      expect(failure, isA<BackendRejectionFailure>());
      final rejection = failure as BackendRejectionFailure;
      expect(rejection.code, HttpFailureCode.rejected);
      expect(rejection.statusCode, 400);
      expect(rejection.codes, [
        'CART_ITEMS_LIMIT_EXCEEDED',
        'CART_ITEM_QUANTITY_EXCEEDED',
      ]);
      expect(rejection.message, 'Não foi possível concluir. Tente novamente.');
    });

    test('409 com message em texto vira recusa com um código', () {
      final failure = mapHttpFailure(
        _badResponse(409, _apiError(409, 'ORDER_ALREADY_PAID')),
      );

      final rejection = failure as BackendRejectionFailure;
      expect(rejection.statusCode, 409);
      expect(rejection.codes, ['ORDER_ALREADY_PAID']);
    });

    test('422 sem corpo vira recusa sem códigos', () {
      final failure = mapHttpFailure(_badResponse(422));

      final rejection = failure as BackendRejectionFailure;
      expect(rejection.statusCode, 422);
      expect(rejection.codes, isEmpty);
    });

    for (final statusCode in [500, 503]) {
      test('$statusCode com corpo HTML vira erro do servidor', () {
        final failure = mapHttpFailure(_badResponse(statusCode, _htmlBody));

        expect(failure, isA<ServerFailure>());
        expect(failure.code, HttpFailureCode.server);
        expect(
          failure.message,
          'O servidor está indisponível no momento. '
          'Tente novamente em instantes.',
        );
      });
    }
  });

  group('mapHttpFailure: bordas', () {
    test('itens não-texto de message são descartados', () {
      final failure = mapHttpFailure(
        _badResponse(400, _apiError(400, ['CART_EMPTY', 42, null, true])),
      );

      expect((failure as BackendRejectionFailure).codes, ['CART_EMPTY']);
    });

    test('corpo HTML num 4xx vira recusa sem códigos', () {
      final failure = mapHttpFailure(_badResponse(400, _htmlBody));

      expect((failure as BackendRejectionFailure).codes, isEmpty);
    });

    for (final type in [DioExceptionType.cancel, DioExceptionType.unknown]) {
      test('$type vira falha inesperada', () {
        final failure = mapHttpFailure(_error(type));

        expect(failure, isA<UnexpectedFailure>());
        expect(failure.code, HttpFailureCode.unexpected);
        expect(failure.message, 'Algo deu errado. Tente novamente.');
      });
    }

    test('resposta sem status vira falha inesperada', () {
      expect(mapHttpFailure(_badResponse(null)), isA<UnexpectedFailure>());
    });

    test('nenhuma mensagem contém o código recebido', () {
      const code = 'CART_ITEMS_LIMIT_EXCEEDED';
      for (final statusCode in [400, 401, 404, 409, 422, 500, 503]) {
        final failure = mapHttpFailure(
          _badResponse(statusCode, _apiError(statusCode, [code])),
        );

        expect(failure.message, isNot(contains(code)), reason: '$statusCode');
        expect(failure.message, isNot(contains('$statusCode')));
      }
    });
  });
}
