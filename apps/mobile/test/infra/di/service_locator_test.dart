import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/infra/di/service_locator.dart';
import 'package:mobile/infra/storage/key_value_store.dart';
import 'package:mobile/infra/store/api_store_repository.dart';
import 'package:mobile/modules/store/provider/store_repository.dart';
import 'package:mobile/ui/modules/store/view_models/store_selector_view_model.dart';

import '../../modules/store/support/fake_store_repository.dart';

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

    test('registra o KeyValueStore e o StoreRepository da API', () {
      configureDependencies(apiBaseUrl: Uri.parse('http://localhost:4000'));

      expect(getIt.isRegistered<KeyValueStore>(), isTrue);
      expect(getIt<StoreRepository>(), isA<ApiStoreRepository>());
    });

    test('o StoreRepository é singleton: a lista guardada vale para o app '
        'inteiro', () {
      configureDependencies(apiBaseUrl: Uri.parse('http://localhost:4000'));

      expect(
        identical(getIt<StoreRepository>(), getIt<StoreRepository>()),
        isTrue,
      );
    });

    test('o StoreSelectorViewModel é uma instância nova a cada pedido', () {
      configureDependencies(apiBaseUrl: Uri.parse('http://localhost:4000'));

      final first = getIt<StoreSelectorViewModel>();
      final second = getIt<StoreSelectorViewModel>();
      addTearDown(first.dispose);
      addTearDown(second.dispose);

      expect(identical(first, second), isFalse);
    });
  });

  group('registerViewModels', () {
    test('registra os ViewModels sobre o repositório já registrado, sem Dio '
        'nem armazenamento', () {
      getIt.registerSingleton<StoreRepository>(FakeStoreRepository());

      registerViewModels();

      final viewModel = getIt<StoreSelectorViewModel>();
      addTearDown(viewModel.dispose);
      expect(viewModel, isA<StoreSelectorViewModel>());
      expect(getIt.isRegistered<Dio>(), isFalse);
      expect(getIt.isRegistered<KeyValueStore>(), isFalse);
    });
  });

  test('resetDependencies remove os registros', () async {
    configureDependencies(apiBaseUrl: Uri.parse('http://localhost:4000'));

    await resetDependencies();

    expect(getIt.isRegistered<Dio>(), isFalse);
    expect(getIt.isRegistered<StoreRepository>(), isFalse);
    expect(getIt.isRegistered<StoreSelectorViewModel>(), isFalse);
  });
}
