import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/infra/auth/secure_session_storage.dart';
import 'package:mobile/infra/auth/session.dart';
import 'package:mobile/infra/auth/session_repository.dart';
import 'package:mobile/infra/auth/session_status.dart';
import 'package:mobile/infra/auth/session_storage.dart';
import 'package:mobile/infra/cart/account_cart_api.dart';
import 'package:mobile/infra/cart/guest_cart_repository.dart';
import 'package:mobile/infra/cart/guest_cart_storage.dart';
import 'package:mobile/infra/cart/session_cart_repository.dart';
import 'package:mobile/infra/catalog/api_catalog_repository.dart';
import 'package:mobile/infra/customer/api_customer_repository.dart';
import 'package:mobile/infra/di/service_locator.dart';
import 'package:mobile/infra/http/auth_interceptor.dart';
import 'package:mobile/infra/order/api_order_repository.dart';
import 'package:mobile/infra/storage/key_value_store.dart';
import 'package:mobile/infra/store/api_store_repository.dart';
import 'package:mobile/modules/auth/provider/auth_repository.dart';
import 'package:mobile/modules/cart/provider/cart_repository.dart';
import 'package:mobile/modules/catalog/provider/catalog_repository.dart';
import 'package:mobile/modules/customer/provider/customer_repository.dart';
import 'package:mobile/modules/customer/usecase/load_delivery_details_use_case.dart';
import 'package:mobile/modules/order/provider/order_repository.dart';
import 'package:mobile/modules/store/provider/store_repository.dart';
import 'package:mobile/ui/modules/auth/view_models/account_view_model.dart';
import 'package:mobile/ui/modules/auth/view_models/login_view_model.dart';
import 'package:mobile/ui/modules/auth/view_models/register_view_model.dart';
import 'package:mobile/ui/modules/cart/view_models/cart_view_model.dart';
import 'package:mobile/ui/modules/catalog/view_models/home_view_model.dart';
import 'package:mobile/ui/modules/catalog/view_models/product_detail_view_model.dart';
import 'package:mobile/ui/modules/catalog/view_models/search_view_model.dart';
import 'package:mobile/ui/modules/customer/view_models/delivery_details_view_model.dart';
import 'package:mobile/ui/modules/order/view_models/checkout_view_model.dart';
import 'package:mobile/ui/modules/store/view_models/store_selector_view_model.dart';

import '../../modules/auth/support/fake_auth_repository.dart';
import '../../modules/cart/support/fake_cart_repository.dart';
import '../../modules/catalog/support/fake_catalog_repository.dart';
import '../../modules/customer/support/fake_customer_repository.dart';
import '../../modules/order/support/fake_order_repository.dart';
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

    test('o LoginViewModel é uma instância nova a cada pedido', () {
      configureDependencies(apiBaseUrl: Uri.parse('http://localhost:4000'));

      final first = getIt<LoginViewModel>();
      final second = getIt<LoginViewModel>();
      addTearDown(first.dispose);
      addTearDown(second.dispose);

      expect(identical(first, second), isFalse);
    });

    test('o RegisterViewModel é uma instância nova a cada pedido', () {
      configureDependencies(apiBaseUrl: Uri.parse('http://localhost:4000'));

      final first = getIt<RegisterViewModel>();
      final second = getIt<RegisterViewModel>();
      addTearDown(first.dispose);
      addTearDown(second.dispose);

      expect(identical(first, second), isFalse);
    });

    test('o AccountViewModel é uma instância nova a cada pedido', () {
      configureDependencies(apiBaseUrl: Uri.parse('http://localhost:4000'));

      final first = getIt<AccountViewModel>();
      final second = getIt<AccountViewModel>();
      addTearDown(first.dispose);
      addTearDown(second.dispose);

      expect(identical(first, second), isFalse);
    });

    test('Session, AuthRepository e SessionRepository são a mesma '
        'instância', () {
      configureDependencies(apiBaseUrl: Uri.parse('http://localhost:4000'));

      final repository = getIt<SessionRepository>();

      expect(getIt<SessionStorage>(), isA<SecureSessionStorage>());
      expect(identical(getIt<Session>(), repository), isTrue);
      expect(identical(getIt<AuthRepository>(), repository), isTrue);
      expect(identical(getIt<SessionRepository>(), repository), isTrue);
    });

    test('CartRepository é o SessionCartRepository', () {
      configureDependencies(apiBaseUrl: Uri.parse('http://localhost:4000'));

      final repository = getIt<SessionCartRepository>();

      expect(getIt.isRegistered<GuestCartStorage>(), isTrue);
      expect(getIt.isRegistered<GuestCartRepository>(), isTrue);
      expect(getIt.isRegistered<AccountCartApi>(), isTrue);
      expect(identical(getIt<CartRepository>(), repository), isTrue);
      expect(identical(getIt<SessionCartRepository>(), repository), isTrue);
      expect(
        identical(getIt<CartRepository>(), getIt<GuestCartRepository>()),
        isFalse,
      );
    });

    test('o CartViewModel é uma instância nova a cada pedido', () {
      configureDependencies(apiBaseUrl: Uri.parse('http://localhost:4000'));

      final first = getIt<CartViewModel>();
      final second = getIt<CartViewModel>();
      addTearDown(first.dispose);
      addTearDown(second.dispose);

      expect(identical(first, second), isFalse);
    });

    test('registra o CustomerRepository da API como singleton', () {
      configureDependencies(apiBaseUrl: Uri.parse('http://localhost:4000'));

      expect(getIt<CustomerRepository>(), isA<ApiCustomerRepository>());
      expect(
        identical(getIt<CustomerRepository>(), getIt<CustomerRepository>()),
        isTrue,
      );
    });

    test('registra o OrderRepository da API como singleton', () {
      configureDependencies(apiBaseUrl: Uri.parse('http://localhost:4000'));

      expect(getIt<OrderRepository>(), isA<ApiOrderRepository>());
      expect(
        identical(getIt<OrderRepository>(), getIt<OrderRepository>()),
        isTrue,
      );
    });

    test('o LoadDeliveryDetails é uma instância nova a cada pedido', () {
      configureDependencies(apiBaseUrl: Uri.parse('http://localhost:4000'));

      expect(
        identical(getIt<LoadDeliveryDetails>(), getIt<LoadDeliveryDetails>()),
        isFalse,
      );
    });

    test('o Dio tem um AuthInterceptor', () {
      configureDependencies(apiBaseUrl: Uri.parse('http://localhost:4000'));

      expect(
        getIt<Dio>().interceptors.whereType<AuthInterceptor>(),
        hasLength(1),
      );
    });

    test('resolver o Dio e a Session não entra em ciclo', () {
      configureDependencies(apiBaseUrl: Uri.parse('http://localhost:4000'));

      final dio = getIt<Dio>();
      final session = getIt<Session>();

      expect(dio, isA<Dio>());
      expect(session.status, SessionStatus.unknown);
      expect(session.token, isNull);
    });
  });

  group('registerViewModels', () {
    test('registra os ViewModels sobre os repositórios já registrados, sem '
        'Dio nem armazenamento', () {
      getIt.registerSingleton<StoreRepository>(FakeStoreRepository());
      getIt.registerSingleton<CatalogRepository>(FakeCatalogRepository());
      final auth = FakeAuthRepository();
      addTearDown(auth.dispose);
      getIt.registerSingleton<AuthRepository>(auth);
      final cart = FakeCartRepository();
      addTearDown(cart.dispose);
      getIt.registerSingleton<CartRepository>(cart);
      getIt.registerSingleton<CustomerRepository>(FakeCustomerRepository());
      getIt.registerSingleton<OrderRepository>(FakeOrderRepository());

      registerViewModels();

      final storeSelector = getIt<StoreSelectorViewModel>();
      final home = getIt<HomeViewModel>();
      final search = getIt<SearchViewModel>();
      final productDetail = getIt<ProductDetailViewModel>();
      addTearDown(storeSelector.dispose);
      addTearDown(home.dispose);
      addTearDown(search.dispose);
      final login = getIt<LoginViewModel>();
      final register = getIt<RegisterViewModel>();
      final account = getIt<AccountViewModel>();
      final cartViewModel = getIt<CartViewModel>();
      addTearDown(productDetail.dispose);
      addTearDown(cartViewModel.dispose);
      addTearDown(login.dispose);
      addTearDown(register.dispose);
      addTearDown(account.dispose);
      final deliveryDetails = getIt<DeliveryDetailsViewModel>();
      final otherDeliveryDetails = getIt<DeliveryDetailsViewModel>();
      addTearDown(deliveryDetails.dispose);
      addTearDown(otherDeliveryDetails.dispose);
      expect(deliveryDetails, isA<DeliveryDetailsViewModel>());
      expect(identical(deliveryDetails, otherDeliveryDetails), isFalse);
      final checkout = getIt<CheckoutViewModel>();
      final otherCheckout = getIt<CheckoutViewModel>();
      addTearDown(checkout.dispose);
      addTearDown(otherCheckout.dispose);
      expect(checkout, isA<CheckoutViewModel>());
      expect(identical(checkout, otherCheckout), isFalse);
      expect(storeSelector, isA<StoreSelectorViewModel>());
      expect(home, isA<HomeViewModel>());
      expect(search, isA<SearchViewModel>());
      expect(productDetail, isA<ProductDetailViewModel>());
      expect(login, isA<LoginViewModel>());
      expect(register, isA<RegisterViewModel>());
      expect(account, isA<AccountViewModel>());
      expect(cartViewModel, isA<CartViewModel>());
      expect(getIt<LoadDeliveryDetails>(), isA<LoadDeliveryDetails>());
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
    expect(getIt.isRegistered<SessionRepository>(), isFalse);
    expect(getIt.isRegistered<Session>(), isFalse);
    expect(getIt.isRegistered<AuthRepository>(), isFalse);
    expect(getIt.isRegistered<GuestCartRepository>(), isFalse);
    expect(getIt.isRegistered<AccountCartApi>(), isFalse);
    expect(getIt.isRegistered<SessionCartRepository>(), isFalse);
    expect(getIt.isRegistered<CartRepository>(), isFalse);
    expect(getIt.isRegistered<CustomerRepository>(), isFalse);
    expect(getIt.isRegistered<OrderRepository>(), isFalse);
    expect(getIt.isRegistered<LoadDeliveryDetails>(), isFalse);
    expect(getIt.isRegistered<StoreSelectorViewModel>(), isFalse);
    expect(getIt.isRegistered<HomeViewModel>(), isFalse);
    expect(getIt.isRegistered<SearchViewModel>(), isFalse);
    expect(getIt.isRegistered<ProductDetailViewModel>(), isFalse);
    expect(getIt.isRegistered<LoginViewModel>(), isFalse);
    expect(getIt.isRegistered<RegisterViewModel>(), isFalse);
    expect(getIt.isRegistered<AccountViewModel>(), isFalse);
    expect(getIt.isRegistered<CartViewModel>(), isFalse);
    expect(getIt.isRegistered<CheckoutViewModel>(), isFalse);
  });
}
