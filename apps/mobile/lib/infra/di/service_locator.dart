import 'package:dio/dio.dart';
import 'package:get_it/get_it.dart';

import '../../modules/auth/provider/auth_repository.dart';
import '../../modules/cart/provider/cart_repository.dart';
import '../../modules/catalog/provider/catalog_repository.dart';
import '../../modules/store/provider/store_repository.dart';
import '../../ui/modules/auth/view_models/account_view_model.dart';
import '../../ui/modules/auth/view_models/login_view_model.dart';
import '../../ui/modules/auth/view_models/register_view_model.dart';
import '../../ui/modules/cart/view_models/cart_view_model.dart';
import '../../ui/modules/catalog/view_models/home_view_model.dart';
import '../../ui/modules/catalog/view_models/product_detail_view_model.dart';
import '../../ui/modules/catalog/view_models/search_view_model.dart';
import '../../ui/modules/store/view_models/store_selector_view_model.dart';
import '../auth/secure_session_storage.dart';
import '../auth/session.dart';
import '../auth/session_repository.dart';
import '../auth/session_storage.dart';
import '../cart/account_cart_api.dart';
import '../cart/guest_cart_repository.dart';
import '../cart/guest_cart_storage.dart';
import '../cart/session_cart_repository.dart';
import '../catalog/api_catalog_repository.dart';
import '../http/api_client.dart';
import '../http/auth_interceptor.dart';
import '../storage/key_value_store.dart';
import '../storage/shared_preferences_key_value_store.dart';
import '../store/api_store_repository.dart';

/// Localizador único do app. Só `lib/infra/di` e `lib/app` o importam (regra D
/// da barreira); o resto recebe dependências pelo construtor.
final getIt = GetIt.instance;

/// Registra as dependências do app; o bootstrap chama uma vez só (registro
/// duplicado lança). Infraestrutura (cliente HTTP, armazenamento,
/// repositórios) entra como lazy singleton; os ViewModels, em
/// [registerViewModels].
void configureDependencies({required Uri apiBaseUrl}) {
  // Os fechamentos do interceptor resolvem a sessão só na hora da requisição:
  // o `SessionRepository` depende do `Dio`, e não o contrário.
  getIt.registerLazySingleton<Dio>(
    () => createApiClient(apiBaseUrl)
      ..interceptors.add(
        AuthInterceptor(
          readToken: () => getIt<Session>().token,
          onUnauthorized: () => getIt<Session>().expire(),
        ),
      ),
  );
  getIt.registerLazySingleton<KeyValueStore>(
    SharedPreferencesKeyValueStore.new,
  );
  getIt.registerLazySingleton<StoreRepository>(
    () => ApiStoreRepository(getIt<Dio>(), getIt<KeyValueStore>()),
  );
  getIt.registerLazySingleton<CatalogRepository>(
    () => ApiCatalogRepository(getIt<Dio>()),
  );
  getIt.registerLazySingleton<SessionStorage>(SecureSessionStorage.new);
  // Uma instância só atende o domínio (`AuthRepository`) e o router e o
  // interceptor (`Session`).
  getIt.registerLazySingleton<SessionRepository>(
    () => SessionRepository(getIt<Dio>(), getIt<SessionStorage>()),
    dispose: (repository) => repository.dispose(),
  );
  getIt.registerLazySingleton<Session>(() => getIt<SessionRepository>());
  getIt.registerLazySingleton<AuthRepository>(() => getIt<SessionRepository>());
  getIt.registerLazySingleton<GuestCartStorage>(
    () => GuestCartStorage(getIt<KeyValueStore>()),
  );
  // O visitante é a fonte sem sessão: o bootstrap o restaura e o
  // `SessionCartRepository` delega a ele.
  getIt.registerLazySingleton<GuestCartRepository>(
    () => GuestCartRepository(getIt<Dio>(), getIt<GuestCartStorage>()),
    dispose: (repository) => repository.dispose(),
  );
  getIt.registerLazySingleton<AccountCartApi>(
    () => AccountCartApi(getIt<Dio>()),
  );
  // Como a sessão: a mesma instância atende o bootstrap (`start`) e o
  // domínio (`CartRepository`).
  getIt.registerLazySingleton<SessionCartRepository>(
    () => SessionCartRepository(
      getIt<GuestCartRepository>(),
      getIt<AccountCartApi>(),
      getIt<Session>(),
    ),
    dispose: (repository) => repository.dispose(),
  );
  getIt.registerLazySingleton<CartRepository>(
    () => getIt<SessionCartRepository>(),
  );
  registerViewModels();
}

/// Registra os ViewModels, sempre com `registerFactory` (instância nova a cada
/// pedido; singleton devolveria estado velho ao voltar à tela). Público para
/// os testes de app e de rotas registrarem repositórios fake e chamarem só
/// esta parte, sem rede nem disco.
void registerViewModels() {
  getIt.registerFactory<StoreSelectorViewModel>(
    () => StoreSelectorViewModel(getIt<StoreRepository>()),
  );
  getIt.registerFactory<HomeViewModel>(
    () => HomeViewModel(getIt<CatalogRepository>()),
  );
  getIt.registerFactory<SearchViewModel>(
    () => SearchViewModel(getIt<CatalogRepository>()),
  );
  getIt.registerFactory<ProductDetailViewModel>(
    () => ProductDetailViewModel(
      getIt<CatalogRepository>(),
      getIt<CartRepository>(),
    ),
  );
  getIt.registerFactory<LoginViewModel>(
    () => LoginViewModel(getIt<AuthRepository>()),
  );
  getIt.registerFactory<RegisterViewModel>(
    () => RegisterViewModel(getIt<AuthRepository>()),
  );
  getIt.registerFactory<AccountViewModel>(
    () => AccountViewModel(getIt<AuthRepository>()),
  );
  getIt.registerFactory<CartViewModel>(
    () => CartViewModel(getIt<CartRepository>()),
  );
}

/// Limpa todos os registros; usado no `tearDown` dos testes.
Future<void> resetDependencies() => getIt.reset();
