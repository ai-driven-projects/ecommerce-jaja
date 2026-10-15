import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/modules/customer/errors/customer_errors.dart';
import 'package:mobile/modules/customer/model/customer_entity.dart';
import 'package:mobile/modules/customer/model/customer_rules.dart';
import 'package:mobile/modules/customer/usecase/load_delivery_details_use_case.dart';
import 'package:mobile/ui/modules/customer/view_models/delivery_details_view_model.dart';
import 'package:mobile/ui/shared/view_models/block_state.dart';

import '../../../../modules/auth/support/auth_fixtures.dart';
import '../../../../modules/auth/support/fake_auth_repository.dart';
import '../../../../modules/customer/support/customer_fixtures.dart';
import '../../../../modules/customer/support/fake_customer_repository.dart';
import '../../../../modules/store/support/fake_store_repository.dart';
import '../../../../modules/store/support/store_fixtures.dart';

const _serverDown = ServerFailure(
  message:
      'O servidor está indisponível no momento. Tente novamente em '
      'instantes.',
  code: HttpFailureCode.server,
);

BackendRejectionFailure _rejection(int statusCode, List<String> codes) =>
    BackendRejectionFailure(
      message: 'Não foi possível concluir. Tente novamente.',
      code: HttpFailureCode.rejected,
      statusCode: statusCode,
      codes: codes,
    );

/// Campos válidos de quem ainda não tem cadastro, em São Paulo.
const _newCustomerFields = {
  CustomerField.cpf: '529.982.247-25',
  CustomerField.phone: '(11) 98888-7777',
  CustomerField.zipCode: '01310-100',
  CustomerField.street: 'Avenida Paulista',
  CustomerField.number: '1000',
  CustomerField.neighborhood: 'Bela Vista',
};

void main() {
  late FakeCustomerRepository customers;
  late FakeStoreRepository stores;
  late FakeAuthRepository auth;
  late DeliveryDetailsViewModel viewModel;

  setUp(() {
    customers = FakeCustomerRepository();
    stores = FakeStoreRepository(stores: [paulista, rioBranco]);
    auth = FakeAuthRepository(currentUser: ana);
    viewModel = DeliveryDetailsViewModel(
      LoadDeliveryDetails(customers, stores),
      customers,
      auth,
    );
  });

  tearDown(() {
    viewModel.dispose();
    auth.dispose();
  });

  Future<void> loadWith(Customer? customer) async {
    customers.mine = customer;
    await viewModel.load.execute();
  }

  void fill(Map<CustomerField, String> values) {
    values.forEach(viewModel.update);
  }

  group('carga', () {
    test('começa carregando, com a conta da sessão', () {
      expect(viewModel.details, isA<BlockLoading<DeliveryDetails>>());
      expect(viewModel.user, ana);
    });

    test('com cadastro, mostra os campos mascarados e sem alteração', () async {
      await loadWith(fortalezaCustomer);

      expect(
        viewModel.details,
        isA<BlockLoaded<DeliveryDetails>>().having(
          (state) => state.value.customer,
          'customer',
          fortalezaCustomer,
        ),
      );
      expect(viewModel.hasCustomer, isTrue);
      expect(viewModel.fields, fortalezaFields);
      expect(viewModel.isDirty, isFalse);
      expect(stores.fetchCalls, isEmpty);
    });

    test('com cadastro sem complemento, o complemento fica vazio', () async {
      await loadWith(fortalezaCustomerWithoutLocation);

      expect(viewModel.fields.complement, '');
      expect(viewModel.isDirty, isFalse);
    });

    test('sem cadastro, vazio com a cidade/UF da loja escolhida', () async {
      stores.rememberedSlug = rioBranco.slug;

      await loadWith(null);

      expect(viewModel.hasCustomer, isFalse);
      expect(
        viewModel.fields,
        const CustomerFields(city: 'Rio de Janeiro', state: 'RJ'),
      );
      expect(viewModel.isDirty, isFalse);
    });

    test('sem cadastro e sem cidade/UF da loja, tudo vazio', () async {
      stores.enqueue(const Failure(_serverDown));

      await loadWith(null);

      expect(viewModel.fields, const CustomerFields());
    });

    test('falha vira BlockFailed e load() de novo busca outra vez', () async {
      customers.enqueueFetch(const Failure(_serverDown));

      await viewModel.load.execute();

      expect(
        viewModel.details,
        isA<BlockFailed<DeliveryDetails>>().having(
          (state) => state.failure,
          'failure',
          same(_serverDown),
        ),
      );

      final retry = customers.holdFetch();
      final reload = viewModel.load.execute();

      expect(viewModel.details, isA<BlockLoading<DeliveryDetails>>());

      retry.complete(const Ok(fortalezaCustomer));
      await reload;

      expect(customers.fetchCalls, 2);
      expect(viewModel.details, isA<BlockLoaded<DeliveryDetails>>());
      expect(viewModel.fields, fortalezaFields);
    });

    test('cada carga incrementa formRevision', () async {
      final before = viewModel.formRevision;

      await loadWith(fortalezaCustomer);

      expect(viewModel.formRevision, greaterThan(before));
    });
  });

  group('formulário', () {
    test('update deixa o formulário sujo e avisa os ouvintes', () async {
      await loadWith(fortalezaCustomer);
      var notified = 0;
      viewModel.addListener(() => notified++);

      viewModel.update(CustomerField.phone, '(85) 98888-7777');

      expect(viewModel.fields.phone, '(85) 98888-7777');
      expect(viewModel.isDirty, isTrue);
      expect(notified, 1);
    });

    test(
      'voltar ao valor carregado deixa o formulário sem alteração',
      () async {
        await loadWith(fortalezaCustomer);

        viewModel
          ..update(CustomerField.number, '1600')
          ..update(CustomerField.number, '1500');

        expect(viewModel.isDirty, isFalse);
      },
    );

    test('discard volta ao carregado e incrementa formRevision', () async {
      await loadWith(fortalezaCustomer);
      final revision = viewModel.formRevision;
      viewModel.update(CustomerField.phone, '(85) 98888-7777');

      viewModel.discard();

      expect(viewModel.fields, fortalezaFields);
      expect(viewModel.isDirty, isFalse);
      expect(viewModel.formRevision, revision + 1);
    });

    test('update não muda formRevision', () async {
      await loadWith(fortalezaCustomer);
      final revision = viewModel.formRevision;

      viewModel.update(CustomerField.phone, '(85) 98888-7777');

      expect(viewModel.formRevision, revision);
    });

    test('erros só aparecem depois de tentar salvar', () async {
      await loadWith(fortalezaCustomer);

      viewModel
        ..update(CustomerField.cpf, '529.982.247-24')
        ..update(CustomerField.street, 'A');

      expect(viewModel.errorOf(CustomerField.cpf), isNull);
      expect(viewModel.errorOf(CustomerField.street), isNull);

      await viewModel.save.execute();

      expect(viewModel.errorOf(CustomerField.cpf), 'CPF inválido.');
      expect(
        viewModel.errorOf(CustomerField.street),
        'O texto não atingiu o tamanho mínimo permitido.',
      );
      expect(viewModel.errorOf(CustomerField.phone), isNull);
    });

    test('depois da tentativa, o erro acompanha a edição', () async {
      await loadWith(fortalezaCustomer);
      viewModel.update(CustomerField.cpf, '529.982.247-24');
      await viewModel.save.execute();

      viewModel.update(CustomerField.cpf, '529.982.247-25');

      expect(viewModel.errorOf(CustomerField.cpf), isNull);
    });

    test('inválido não chama saveMine e devolve ValidationFailure, sem '
        'mensagem de formulário', () async {
      await loadWith(fortalezaCustomer);
      viewModel.update(CustomerField.cpf, '529.982.247-24');

      await viewModel.save.execute();

      expect(customers.saveCalls, isEmpty);
      expect(
        viewModel.save.result,
        isA<Failure<Customer>>().having(
          (result) => result.failure,
          'failure',
          isA<ValidationFailure>(),
        ),
      );
      expect(viewModel.formError, isNull);
      expect(viewModel.isDirty, isTrue);
    });

    test('sem cadastro, salvar vazio mostra o erro dos obrigatórios', () async {
      await loadWith(null);

      await viewModel.save.execute();

      expect(customers.saveCalls, isEmpty);
      expect(viewModel.errorOf(CustomerField.cpf), 'CPF inválido.');
      expect(viewModel.errorOf(CustomerField.phone), 'Telefone inválido.');
      expect(viewModel.errorOf(CustomerField.zipCode), 'CEP inválido.');
      expect(viewModel.errorOf(CustomerField.complement), isNull);
      expect(viewModel.errorOf(CustomerField.city), isNull);
      expect(viewModel.errorOf(CustomerField.state), isNull);
    });

    test('discard limpa os erros da tentativa', () async {
      await loadWith(fortalezaCustomer);
      viewModel.update(CustomerField.cpf, '529.982.247-24');
      await viewModel.save.execute();

      viewModel
        ..discard()
        ..update(CustomerField.street, 'A');

      expect(viewModel.errorOf(CustomerField.cpf), isNull);
      expect(viewModel.errorOf(CustomerField.street), isNull);
    });
  });

  group('gravação', () {
    test(
      'o rascunho leva a location carregada, mesmo mudando o endereço',
      () async {
        await loadWith(fortalezaCustomer);
        viewModel.update(CustomerField.number, '1600');

        await viewModel.save.execute();

        expect(customers.saveCalls, hasLength(1));
        final draft = customers.saveCalls.single;
        expect(draft.number, '1600');
        expect(draft.location, fortalezaLocation);
        expect(draft.cpf, '52998224725');
        expect(draft.phone, '85999998888');
        expect(draft.zipCode, '60150160');
      },
    );

    test('cadastro sem ponto continua sem ponto', () async {
      await loadWith(fortalezaCustomerWithoutLocation);
      viewModel.update(CustomerField.number, '1600');

      await viewModel.save.execute();

      expect(customers.saveCalls.single.location, isNull);
      expect(customers.saveCalls.single.complement, isNull);
    });

    test('sem cadastro, o rascunho leva location nula', () async {
      await loadWith(null);
      fill(_newCustomerFields);

      await viewModel.save.execute();

      final draft = customers.saveCalls.single;
      expect(draft.location, isNull);
      expect(draft.city, 'São Paulo');
      expect(draft.state, 'SP');
      expect(draft.complement, isNull);
    });

    test(
      'sucesso deixa o formulário sem alteração, com os valores salvos',
      () async {
        await loadWith(fortalezaCustomer);
        final revision = viewModel.formRevision;
        viewModel
          ..update(CustomerField.phone, '85988887777')
          ..update(CustomerField.state, 'ce');

        await viewModel.save.execute();

        expect(customers.saveCalls.single.phone, '85988887777');
        expect(viewModel.save.result, isA<Ok<Customer>>());
        expect(viewModel.isDirty, isFalse);
        expect(viewModel.fields.phone, '(85) 98888-7777');
        expect(viewModel.fields.state, 'CE');
        expect(viewModel.formRevision, greaterThan(revision));
        expect(viewModel.formError, isNull);
      },
    );

    test('sucesso de quem não tinha cadastro passa a ter cadastro, e a '
        'gravação seguinte leva o ponto devolvido', () async {
      await loadWith(null);
      fill(_newCustomerFields);
      await viewModel.save.execute();

      expect(viewModel.hasCustomer, isTrue);

      customers.enqueueSave(
        Ok(
          fortalezaCustomer.copyWith(
            address: fortalezaCustomer.address.copyWith(number: '2000'),
          ),
        ),
      );
      viewModel.update(CustomerField.number, '2000');
      await viewModel.save.execute();
      viewModel.update(CustomerField.number, '2100');
      await viewModel.save.execute();

      expect(customers.saveCalls[1].location, isNull);
      expect(customers.saveCalls[2].location, fortalezaLocation);
    });

    test('409 de CPF já cadastrado vira erro no CPF, sem mensagem de '
        'formulário, e some ao editar o CPF', () async {
      await loadWith(fortalezaCustomer);
      viewModel.update(CustomerField.cpf, '111.444.777-35');
      customers.enqueueSave(
        Failure(_rejection(409, const ['CUSTOMER_CPF_ALREADY_EXISTS'])),
      );

      await viewModel.save.execute();

      expect(
        viewModel.errorOf(CustomerField.cpf),
        'Este CPF já está cadastrado.',
      );
      expect(viewModel.formError, isNull);
      expect(viewModel.isDirty, isTrue);
      expect(viewModel.fields.cpf, '111.444.777-35');

      viewModel.update(CustomerField.phone, '(85) 98888-7777');

      expect(
        viewModel.errorOf(CustomerField.cpf),
        'Este CPF já está cadastrado.',
      );

      viewModel.update(CustomerField.cpf, '529.982.247-25');

      expect(viewModel.errorOf(CustomerField.cpf), isNull);
    });

    test(
      '400 com códigos de CPF e telefone vira erro nos dois campos',
      () async {
        await loadWith(fortalezaCustomer);
        viewModel.update(CustomerField.number, '1600');
        customers.enqueueSave(
          Failure(
            _rejection(400, const [
              'CPF_INVALID_CHECK_DIGIT',
              'PHONE_INVALID_LENGTH',
            ]),
          ),
        );

        await viewModel.save.execute();

        expect(viewModel.errorOf(CustomerField.cpf), 'CPF inválido.');
        expect(viewModel.errorOf(CustomerField.phone), 'Telefone inválido.');
        expect(viewModel.formError, isNull);
      },
    );

    test('recusa com código sem campo vira mensagem de formulário', () async {
      await loadWith(fortalezaCustomer);
      viewModel.update(CustomerField.number, '1600');
      customers.enqueueSave(
        Failure(_rejection(400, const ['CUSTOMER_STREET_INVALID'])),
      );

      await viewModel.save.execute();

      expect(
        viewModel.formError,
        'Não foi possível concluir. Tente novamente.',
      );
      expect(viewModel.errorOf(CustomerField.street), isNull);
    });

    test('500 vira formError e mantém o que foi digitado', () async {
      await loadWith(fortalezaCustomer);
      viewModel.update(CustomerField.phone, '(85) 98888-7777');
      customers.enqueueSave(const Failure(_serverDown));

      await viewModel.save.execute();

      expect(viewModel.formError, _serverDown.message);
      expect(viewModel.fields.phone, '(85) 98888-7777');
      expect(viewModel.isDirty, isTrue);
      for (final field in CustomerField.values) {
        expect(viewModel.errorOf(field), isNull);
      }
    });

    test('durante o envio, save.running fica ligado', () async {
      await loadWith(fortalezaCustomer);
      viewModel.update(CustomerField.number, '1600');
      final hold = customers.holdSave();

      final saving = viewModel.save.execute();

      expect(viewModel.save.running, isTrue);

      hold.complete(const Ok(fortalezaCustomer));
      await saving;

      expect(viewModel.save.running, isFalse);
    });
  });
}
