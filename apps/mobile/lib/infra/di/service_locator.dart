import 'package:dio/dio.dart';
import 'package:get_it/get_it.dart';

import '../../modules/store/provider/store_repository.dart';
import '../../ui/modules/store/view_models/store_selector_view_model.dart';
import '../http/api_client.dart';
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
  getIt.registerLazySingleton<Dio>(() => createApiClient(apiBaseUrl));
  getIt.registerLazySingleton<KeyValueStore>(
    SharedPreferencesKeyValueStore.new,
  );
  getIt.registerLazySingleton<StoreRepository>(
    () => ApiStoreRepository(getIt<Dio>(), getIt<KeyValueStore>()),
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
}

/// Limpa todos os registros; usado no `tearDown` dos testes.
Future<void> resetDependencies() => getIt.reset();
