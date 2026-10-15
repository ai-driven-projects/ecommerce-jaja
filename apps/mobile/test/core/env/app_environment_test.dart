import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/env/app_environment.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';

String resolve(AppEnvironment environment, String defined) {
  return switch (resolveApiBaseUrl(environment, definedApiUrl: defined)) {
    Ok(:final value) => value.toString(),
    Failure(:final failure) => throw StateError(failure.message),
  };
}

void expectConfigurationFailure(
  AppEnvironment environment,
  String defined,
  ConfigurationCode code,
) {
  switch (resolveApiBaseUrl(environment, definedApiUrl: defined)) {
    case Ok(:final value):
      fail('esperava falha de configuração, veio $value');
    case Failure(:final failure):
      expect(failure, isA<ConfigurationFailure>());
      expect(failure.code, code);
      expect(failure.message, isNotEmpty);
  }
}

void main() {
  group('resolveApiBaseUrl', () {
    test('dev sem API_URL usa http://localhost:4000', () {
      expect(resolve(AppEnvironment.dev, ''), 'http://localhost:4000');
    });

    test('sem argumento usa o define da compilação (vazio nos testes)', () {
      final result = resolveApiBaseUrl(AppEnvironment.dev);

      expect((result as Ok<Uri>).value.toString(), 'http://localhost:4000');
    });

    test('valor definido descarta a barra final', () {
      expect(
        resolve(AppEnvironment.dev, 'http://10.0.2.2:4000/'),
        'http://10.0.2.2:4000',
      );
      expect(
        resolve(AppEnvironment.prod, 'https://api.jaja.com.br'),
        'https://api.jaja.com.br',
      );
    });

    test('prod sem API_URL é falha de configuração', () {
      expectConfigurationFailure(
        AppEnvironment.prod,
        '',
        ConfigurationCode.missingApiUrl,
      );
      expectConfigurationFailure(
        AppEnvironment.prod,
        '   ',
        ConfigurationCode.missingApiUrl,
      );
    });

    for (final invalid in [
      'ftp://x',
      'localhost:4000',
      'sem host',
      'http://',
    ]) {
      test('"$invalid" é falha de configuração', () {
        for (final environment in AppEnvironment.values) {
          expectConfigurationFailure(
            environment,
            invalid,
            ConfigurationCode.invalidApiUrl,
          );
        }
      });
    }
  });
}
