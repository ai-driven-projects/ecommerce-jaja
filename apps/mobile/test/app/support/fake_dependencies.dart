import 'package:mobile/infra/di/service_locator.dart';
import 'package:mobile/modules/store/provider/store_repository.dart';

import '../../modules/store/support/fake_store_repository.dart';
import '../../modules/store/support/store_fixtures.dart';

/// Registra no `getIt` só o que o app precisa para montar as abas nos testes
/// de app e de rotas: um [FakeStoreRepository] (sem rede nem disco) e os
/// ViewModels de verdade, via `registerViewModels()`. Quem chama faz
/// `tearDown(resetDependencies)`.
FakeStoreRepository registerFakeDependencies({
  FakeStoreRepository? storeRepository,
}) {
  final repository =
      storeRepository ??
      FakeStoreRepository(stores: const [paulista, rioBranco]);
  getIt.registerSingleton<StoreRepository>(repository);
  registerViewModels();
  return repository;
}
