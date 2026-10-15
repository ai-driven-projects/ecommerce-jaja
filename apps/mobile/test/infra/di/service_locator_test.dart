import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/infra/catalog/api_catalog_repository.dart';
import 'package:mobile/infra/di/service_locator.dart';
import 'package:mobile/infra/storage/key_value_store.dart';
import 'package:mobile/infra/store/api_store_repository.dart';
import 'package:mobile/modules/catalog/provider/catalog_repository.dart';
import 'package:mobile/modules/store/provider/store_repository.dart';
import 'package:mobile/ui/modules/catalog/view_models/home_view_model.dart';
import 'package:mobile/ui/modules/catalog/view_models/product_detail_view_model.dart';
import 'package:mobile/ui/modules/catalog/view_models/search_view_model.dart';
import 'package:mobile/ui/modules/store/view_models/store_selector_view_model.dart';

import '../../modules/catalog/support/fake_catalog_repository.dart';
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

    test('registra o CatalogRepository da API como singleton: a árvore '
        'guardada vale para o app inteiro', () {
      configureDependencies(apiBaseUrl: Uri.parse('http://localhost:4000'));

      expect(getIt<CatalogRepository>(), isA<ApiCatalogRepository>());
      expect(
        identical(getIt<CatalogRepository>(), getIt<CatalogRepository>()),
        isTrue,
      );
    });

    test('o HomeViewModel é uma instância nova a cada pedido', () {
      configureDependencies(apiBaseUrl: Uri.parse('http://localhost:4000'));

      final first = getIt<HomeViewModel>();
      final second = getIt<HomeViewModel>();
      addTearDown(first.dispose);
      addTearDown(second.dispose);

      expect(identical(first, second), isFalse);
    });

    test('o SearchViewModel é uma instância nova a cada pedido', () {
      configureDependencies(apiBaseUrl: Uri.parse('http://localhost:4000'));

      final first = getIt<SearchViewModel>();
      final second = getIt<SearchViewModel>();
      addTearDown(first.dispose);
      addTearDown(second.dispose);

      expect(identical(first, second), isFalse);
    });

    test('o ProductDetailViewModel é uma instância nova a cada pedido: o '
        'detalhe nunca é guardado', () {
      configureDependencies(apiBaseUrl: Uri.parse('http://localhost:4000'));

      final first = getIt<ProductDetailViewModel>();
      final second = getIt<ProductDetailViewModel>();
      addTearDown(first.dispose);
      addTearDown(second.dispose);

      expect(identical(first, second), isFalse);
    });
  });

  group('registerViewModels', () {
    test('registra os ViewModels sobre os repositórios já registrados, sem '
        'Dio nem armazenamento', () {
      getIt.registerSingleton<StoreRepository>(FakeStoreRepository());
      getIt.registerSingleton<CatalogRepository>(FakeCatalogRepository());

      registerViewModels();

      final storeSelector = getIt<StoreSelectorViewModel>();
      final home = getIt<HomeViewModel>();
      final search = getIt<SearchViewModel>();
      final productDetail = getIt<ProductDetailViewModel>();
      addTearDown(storeSelector.dispose);
      addTearDown(home.dispose);
      addTearDown(search.dispose);
      addTearDown(productDetail.dispose);
      expect(storeSelector, isA<StoreSelectorViewModel>());
      expect(home, isA<HomeViewModel>());
      expect(search, isA<SearchViewModel>());
      expect(productDetail, isA<ProductDetailViewModel>());
      expect(getIt.isRegistered<Dio>(), isFalse);
      expect(getIt.isRegistered<KeyValueStore>(), isFalse);
    });
  });

  test('resetDependencies remove os registros', () async {
    configureDependencies(apiBaseUrl: Uri.parse('http://localhost:4000'));

    await resetDependencies();

    expect(getIt.isRegistered<Dio>(), isFalse);
    expect(getIt.isRegistered<StoreRepository>(), isFalse);
    expect(getIt.isRegistered<CatalogRepository>(), isFalse);
    expect(getIt.isRegistered<StoreSelectorViewModel>(), isFalse);
    expect(getIt.isRegistered<HomeViewModel>(), isFalse);
    expect(getIt.isRegistered<SearchViewModel>(), isFalse);
    expect(getIt.isRegistered<ProductDetailViewModel>(), isFalse);
  });
}
