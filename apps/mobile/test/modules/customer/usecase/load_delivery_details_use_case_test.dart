import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/core/value_objects/city_state.dart';
import 'package:mobile/modules/customer/usecase/load_delivery_details_use_case.dart';

import '../../store/support/fake_store_repository.dart';
import '../../store/support/store_fixtures.dart';
import '../support/customer_fixtures.dart';
import '../support/fake_customer_repository.dart';

const _serverDown = ServerFailure(
  message:
      'O servidor está indisponível no momento. Tente novamente em '
      'instantes.',
  code: HttpFailureCode.server,
);

void main() {
  late FakeCustomerRepository customers;
  late FakeStoreRepository stores;
  late LoadDeliveryDetails load;

  setUp(() {
    customers = FakeCustomerRepository();
    stores = FakeStoreRepository(stores: [paulista, rioBranco]);
    load = LoadDeliveryDetails(customers, stores);
  });

  test('com cadastro, devolve o cadastro sem consultar as lojas', () async {
    customers.mine = fortalezaCustomer;

    final result = await load();

    expect(
      (result as Ok<DeliveryDetails>).value,
      const DeliveryDetails(customer: fortalezaCustomer, defaultPlace: null),
    );
    expect(customers.fetchCalls, 1);
    expect(stores.fetchCalls, isEmpty);
  });

  test('sem cadastro, a cidade/UF da loja lembrada', () async {
    stores.rememberedSlug = rioBranco.slug;

    final result = await load();

    expect(
      (result as Ok<DeliveryDetails>).value,
      const DeliveryDetails(
        customer: null,
        defaultPlace: CityState(city: 'Rio de Janeiro', state: 'RJ'),
      ),
    );
  });

  test('sem cadastro e sem loja lembrada, a cidade/UF da primeira', () async {
    final result = await load();

    expect(
      (result as Ok<DeliveryDetails>).value.defaultPlace,
      const CityState(city: 'São Paulo', state: 'SP'),
    );
  });

  test(
    'sem cadastro e loja sem cidade/UF no endereço, defaultPlace nulo',
    () async {
      stores.stores = [paulista.copyWith(address: null)];

      final result = await load();

      expect((result as Ok<DeliveryDetails>).value.defaultPlace, isNull);
    },
  );

  test('falha das lojas não falha a carga: defaultPlace nulo', () async {
    stores.enqueue(const Failure(_serverDown));

    final result = await load();

    expect(
      (result as Ok<DeliveryDetails>).value,
      const DeliveryDetails(customer: null, defaultPlace: null),
    );
  });

  test('falha do cadastro é devolvida, sem consultar as lojas', () async {
    customers.enqueueFetch(const Failure(_serverDown));

    final result = await load();

    expect((result as Failure<DeliveryDetails>).failure, same(_serverDown));
    expect(stores.fetchCalls, isEmpty);
  });
}
