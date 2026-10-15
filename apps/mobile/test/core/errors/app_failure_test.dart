import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';

String categorize(AppFailure failure) {
  return switch (failure) {
    ValidationFailure() => 'validation',
    NetworkFailure() => 'network',
    ConfigurationFailure() => 'configuration',
    SessionFailure() => 'session',
    BackendRejectionFailure() => 'backend_rejection',
    NotFoundFailure() => 'not_found',
    ServerFailure() => 'server',
    UnexpectedFailure() => 'unexpected',
  };
}

void main() {
  group('AppFailure', () {
    test('switch exaustivo cobre todos os tipos', () {
      const code = GenericFailureCode.unspecified;
      const failures = <AppFailure, String>{
        ValidationFailure(message: 'a', code: MoneyCode.negativeCents):
            'validation',
        NetworkFailure(message: 'b', code: code): 'network',
        ConfigurationFailure(
          message: 'c',
          code: ConfigurationCode.missingApiUrl,
        ): 'configuration',
        SessionFailure(message: 'd', code: code): 'session',
        BackendRejectionFailure(
          message: 'e',
          code: code,
          statusCode: 409,
          codes: [],
        ): 'backend_rejection',
        NotFoundFailure(message: 'f', code: code): 'not_found',
        ServerFailure(message: 'g', code: code): 'server',
        UnexpectedFailure(message: 'h', code: code): 'unexpected',
      };

      failures.forEach((failure, expected) {
        expect(categorize(failure), expected);
      });
    });

    test('recusa do backend expõe status, códigos e mensagem', () {
      const failure = BackendRejectionFailure(
        message: 'O carrinho atingiu o limite de itens.',
        code: GenericFailureCode.unspecified,
        statusCode: 400,
        codes: ['CART_ITEMS_LIMIT_EXCEEDED'],
      );

      expect(failure.statusCode, 400);
      expect(failure.codes, ['CART_ITEMS_LIMIT_EXCEEDED']);
      expect(failure.message, 'O carrinho atingiu o limite de itens.');
    });

    test('recusa do backend preserva a ordem dos códigos', () {
      const failure = BackendRejectionFailure(
        message: 'Revise o pedido.',
        code: GenericFailureCode.unspecified,
        statusCode: 422,
        codes: ['B_CODE', 'A_CODE', 'C_CODE'],
      );

      expect(failure.codes, orderedEquals(['B_CODE', 'A_CODE', 'C_CODE']));
    });

    test('falha inesperada tem uma única mensagem', () {
      expect(unexpectedFailureMessage, 'Algo deu errado. Tente novamente.');
      expect(unspecifiedFailure.message, unexpectedFailureMessage);
      expect(unspecifiedFailure.code, GenericFailureCode.unspecified);
    });
  });
}
