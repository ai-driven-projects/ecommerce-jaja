import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/infra/customer/api_customer_repository.dart';
import 'package:mobile/infra/http/api_client.dart';
import 'package:mobile/modules/customer/model/customer_entity.dart';
import 'package:mobile/modules/customer/model/customer_rules.dart';

import '../../modules/customer/support/customer_fixtures.dart';
import '../api/support/customer_json.dart';
import '../http/support/fake_http_client_adapter.dart';

void main() {
  late FakeHttpClientAdapter adapter;
  late ApiCustomerRepository repository;

  setUp(() {
    adapter = FakeHttpClientAdapter();
    final dio = createApiClient(Uri.parse('http://localhost:4000'))
      ..httpClientAdapter = adapter;
    repository = ApiCustomerRepository(dio);
  });

  T valueOf<T>(Result<T> result) => (result as Ok<T>).value;

  AppFailure failureOf<T>(Result<T> result) => (result as Failure<T>).failure;

  CustomerDraft draftOf({required CustomerLocation? location}) =>
      switch (CustomerDraft.validate(fortalezaFields, location: location)) {
        ValidCustomerDraft(:final draft) => draft,
        InvalidCustomerDraft(:final errors) => throw StateError('$errors'),
      };

  Map<String, Object?> sentAddress() =>
      (adapter.requests.last.data as Map<String, Object?>)['address']
          as Map<String, Object?>;

  group('fetchMine', () {
    test('faz GET /me/customer sem corpo e lê o cadastro', () async {
      adapter.enqueueResponse(body: fortalezaCustomerJson);

      final customer = valueOf(await repository.fetchMine());

      final request = adapter.requests.single;
      expect(request.method, 'GET');
      expect(request.path, '/me/customer');
      expect(request.data, isNull);
      expect(customer, fortalezaCustomer);
    });

    test('404 CUSTOMER_NOT_FOUND vira Ok(null): sem cadastro', () async {
      adapter.enqueueResponse(statusCode: 404, body: customerNotFoundJson);

      final result = await repository.fetchMine();

      expect(result, isA<Ok<Customer?>>());
      expect(valueOf(result), isNull);
    });

    test('500 vira ServerFailure', () async {
      adapter.enqueueResponse(statusCode: 500, body: 'Internal Server Error');

      expect(failureOf(await repository.fetchMine()), isA<ServerFailure>());
    });

    test('sem conexão vira NetworkFailure', () async {
      adapter.enqueueError(DioExceptionType.connectionError);

      expect(failureOf(await repository.fetchMine()), isA<NetworkFailure>());
    });

    test('corpo fora do formato vira falha inesperada', () async {
      adapter.enqueueResponse(body: customerWithout('cpf'));

      expect(failureOf(await repository.fetchMine()), isA<UnexpectedFailure>());
    });
  });

  group('saveMine', () {
    test(
      'faz PUT /me/customer com o corpo do rascunho e lê a resposta',
      () async {
        adapter.enqueueResponse(body: savedFortalezaCustomerJson);

        final customer = valueOf(
          await repository.saveMine(draftOf(location: fortalezaLocation)),
        );

        final request = adapter.requests.single;
        expect(request.method, 'PUT');
        expect(request.path, '/me/customer');
        expect(request.data, {
          'cpf': '52998224725',
          'phone': '85999998888',
          'address': {
            'zipCode': '60150160',
            'street': 'Avenida Santos Dumont',
            'number': '1500',
            'complement': 'Sala 3',
            'neighborhood': 'Aldeota',
            'city': 'Fortaleza',
            'state': 'CE',
            'location': {'latitude': -3.731862, 'longitude': -38.526669},
          },
        });
        expect(customer, fortalezaCustomer);
      },
    );

    test('409 CUSTOMER_CPF_ALREADY_EXISTS mantém statusCode e codes', () async {
      adapter.enqueueResponse(statusCode: 409, body: cpfAlreadyExistsJson);

      final failure = failureOf(
        await repository.saveMine(draftOf(location: null)),
      );

      expect(
        failure,
        isA<BackendRejectionFailure>()
            .having((f) => f.statusCode, 'statusCode', 409)
            .having((f) => f.codes, 'codes', ['CUSTOMER_CPF_ALREADY_EXISTS']),
      );
    });

    test('400 mantém os códigos na ordem recebida', () async {
      adapter.enqueueResponse(statusCode: 400, body: invalidCpfAndPhoneJson);

      final failure = failureOf(
        await repository.saveMine(draftOf(location: null)),
      );

      expect(
        failure,
        isA<BackendRejectionFailure>()
            .having((f) => f.statusCode, 'statusCode', 400)
            .having((f) => f.codes, 'codes', [
              'CPF_INVALID_CHECK_DIGIT',
              'PHONE_INVALID_LENGTH',
            ]),
      );
    });

    test('404 no PUT passa como NotFoundFailure', () async {
      adapter.enqueueResponse(statusCode: 404, body: customerNotFoundJson);

      expect(
        failureOf(await repository.saveMine(draftOf(location: null))),
        isA<NotFoundFailure>(),
      );
    });
  });

  group('preservação do ponto', () {
    test('o ponto do GET volta igual no PUT', () async {
      adapter
        ..enqueueResponse(body: fortalezaCustomerJson)
        ..enqueueResponse(body: savedFortalezaCustomerJson);

      final loaded = valueOf(await repository.fetchMine());
      await repository.saveMine(draftOf(location: loaded?.address.location));

      expect(adapter.requests.map((request) => request.method), ['GET', 'PUT']);
      expect(sentAddress()['location'], fortalezaLocationJson);
    });

    test('cadastro sem ponto vai com "location": null', () async {
      adapter
        ..enqueueResponse(body: fortalezaCustomerWithoutLocationJson)
        ..enqueueResponse(body: fortalezaCustomerWithoutLocationJson);

      final loaded = valueOf(await repository.fetchMine());
      await repository.saveMine(draftOf(location: loaded?.address.location));

      expect(sentAddress().containsKey('location'), isTrue);
      expect(sentAddress()['location'], isNull);
    });

    test('sem cadastro, o PUT vai com "location": null', () async {
      adapter
        ..enqueueResponse(statusCode: 404, body: customerNotFoundJson)
        ..enqueueResponse(body: fortalezaCustomerWithoutLocationJson);

      final loaded = valueOf(await repository.fetchMine());
      await repository.saveMine(draftOf(location: loaded?.address.location));

      expect(loaded, isNull);
      expect(sentAddress().containsKey('location'), isTrue);
      expect(sentAddress()['location'], isNull);
    });
  });
}
