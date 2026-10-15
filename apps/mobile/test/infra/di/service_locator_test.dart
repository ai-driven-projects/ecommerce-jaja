import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/infra/di/service_locator.dart';

void main() {
  tearDown(resetDependencies);

  group('configureDependencies', () {
    test('registra o Dio', () {
      configureDependencies(apiBaseUrl: Uri.parse('http://localhost:4000'));

      expect(getIt.isRegistered<Dio>(), isTrue);
    });

    test('entrega sempre a mesma instância do Dio', () {
      configureDependencies(apiBaseUrl: Uri.parse('http://localhost:4000'));

      expect(identical(getIt<Dio>(), getIt<Dio>()), isTrue);
    });

    test('o Dio usa o endereço base dado', () {
      configureDependencies(apiBaseUrl: Uri.parse('http://10.0.2.2:4000'));

      expect(getIt<Dio>().options.baseUrl, 'http://10.0.2.2:4000');
    });
  });

  test('resetDependencies remove os registros', () async {
    configureDependencies(apiBaseUrl: Uri.parse('http://localhost:4000'));

    await resetDependencies();

    expect(getIt.isRegistered<Dio>(), isFalse);
  });
}
