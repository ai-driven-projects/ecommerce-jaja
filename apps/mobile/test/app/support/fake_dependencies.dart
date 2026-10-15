import 'package:mobile/infra/auth/session.dart';
import 'package:mobile/infra/di/service_locator.dart';
import 'package:mobile/modules/auth/provider/auth_repository.dart';
import 'package:mobile/modules/cart/provider/cart_repository.dart';
import 'package:mobile/modules/catalog/provider/catalog_repository.dart';
import 'package:mobile/modules/customer/provider/customer_repository.dart';
import 'package:mobile/modules/order/provider/order_live_source.dart';
import 'package:mobile/modules/order/provider/order_repository.dart';
import 'package:mobile/modules/store/provider/store_repository.dart';

import '../../modules/auth/support/fake_auth_repository.dart';
import '../../modules/cart/support/fake_cart_repository.dart';
import '../../modules/catalog/support/catalog_fixtures.dart';
import '../../modules/catalog/support/fake_catalog_repository.dart';
import '../../modules/customer/support/fake_customer_repository.dart';
import '../../modules/order/support/fake_order_live_source.dart';
import '../../modules/order/support/fake_order_repository.dart';
import '../../modules/store/support/fake_store_repository.dart';
import '../../modules/store/support/store_fixtures.dart';

/// Registra no `getIt` só o que o app precisa para montar as abas nos testes
/// de app e de rotas: um [FakeStoreRepository] e um [FakeCatalogRepository]
/// (sem rede nem disco) e os ViewModels de verdade, via `registerViewModels()`.
/// Quem chama faz `tearDown(resetDependencies)`. Devolve o fake de loja.
///
/// A sessão é o [FakeAuthRepository] de [auth] (padrão: sem sessão),
/// registrado como `Session` (guarda e `refreshListenable` do router) e como
/// `AuthRepository` (ViewModels de acesso), a mesma instância como no app.
/// O carrinho é o [FakeCartRepository] de [cart] (padrão: vazio, restaurado),
/// registrado como `CartRepository`. Os dados de entrega são o
/// [FakeCustomerRepository] de [customer] (padrão: sem cadastro), registrado
/// como `CustomerRepository`. Os pedidos são o [FakeOrderRepository] de
/// [order] (padrão: todo pedido é aceito), registrado como `OrderRepository`.
/// Os avisos ao vivo são o [FakeOrderLiveSource] de [liveSource] (padrão:
/// conexões abertas sem eventos), registrado como `OrderLiveSource`.
///
/// O catálogo padrão são as fixtures do seed sem foto: a Início monta os
/// cards logo ao abrir, e uma foto de verdade acionaria o cache do aparelho,
/// que o `flutter_test` não tem (ver `test/ui/shared/support/fake_image_loads.dart`).
FakeStoreRepository registerFakeDependencies({
  FakeStoreRepository? storeRepository,
  FakeCatalogRepository? catalogRepository,
  FakeAuthRepository? auth,
  FakeCartRepository? cart,
  FakeCustomerRepository? customer,
  FakeOrderRepository? order,
  FakeOrderLiveSource? liveSource,
}) {
  final repository =
      storeRepository ??
      FakeStoreRepository(stores: const [paulista, rioBranco]);
  final catalog =
      catalogRepository ??
      FakeCatalogRepository(
        products: [
          for (final product in products) product.copyWith(thumbUrl: null),
        ],
      );
  getIt.registerSingleton<StoreRepository>(repository);
  getIt.registerSingleton<CatalogRepository>(catalog);
  final session = auth ?? FakeAuthRepository();
  getIt.registerSingleton<Session>(session);
  getIt.registerSingleton<AuthRepository>(session);
  getIt.registerSingleton<CartRepository>(cart ?? FakeCartRepository());
  getIt.registerSingleton<CustomerRepository>(
    customer ?? FakeCustomerRepository(),
  );
  getIt.registerSingleton<OrderRepository>(order ?? FakeOrderRepository());
  getIt.registerSingleton<OrderLiveSource>(
    liveSource ?? FakeOrderLiveSource(),
  );
  registerViewModels();
  return repository;
}
