import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';

String describe(Result<int> result) {
  return switch (result) {
    Ok(:final value) => 'ok:$value',
    Failure(:final failure) => 'failure:${failure.message}',
  };
}

void main() {
  group('Result<T>', () {
    test('sucesso carrega o valor, lido por desestruturação', () {
      const Result<int> result = Ok(42);

      expect(describe(result), 'ok:42');
      expect((result as Ok<int>).value, 42);
    });

    test('falha carrega a falha tipada, lida por desestruturação', () {
      const failure = NetworkFailure(
        message: 'Sem conexão com a internet.',
        code: GenericFailureCode.unspecified,
      );
      const Result<int> result = Failure(failure);

      expect(describe(result), 'failure:Sem conexão com a internet.');
      switch (result) {
        case Ok():
          fail('esperava Failure');
        case Failure(:final failure):
          expect(failure, isA<NetworkFailure>());
      }
    });
  });
}
