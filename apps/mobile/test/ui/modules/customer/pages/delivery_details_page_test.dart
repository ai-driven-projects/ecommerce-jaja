import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/modules/customer/model/customer_entity.dart';
import 'package:mobile/modules/customer/usecase/load_delivery_details_use_case.dart';
import 'package:mobile/ui/modules/customer/pages/delivery_details_page.dart';
import 'package:mobile/ui/modules/customer/view_models/delivery_details_view_model.dart';
import 'package:mobile/ui/modules/customer/widgets/account_data_card.dart';
import 'package:mobile/ui/modules/customer/widgets/address_fields.dart';
import 'package:mobile/ui/modules/customer/widgets/personal_data_fields.dart';
import 'package:mobile/ui/shared/theme/app_theme.dart';
import 'package:mobile/ui/shared/widgets/app_button.dart';
import 'package:mobile/ui/shared/widgets/app_text_field.dart';
import 'package:mobile/ui/shared/widgets/skeleton_box.dart';

import '../../../../modules/auth/support/auth_fixtures.dart';
import '../../../../modules/auth/support/fake_auth_repository.dart';
import '../../../../modules/customer/support/customer_fixtures.dart';
import '../../../../modules/customer/support/fake_customer_repository.dart';
import '../../../../modules/store/support/fake_store_repository.dart';
import '../../../../modules/store/support/store_fixtures.dart';

const _serverDownMessage =
    'O servidor está indisponível no momento. Tente novamente em instantes.';

const _serverDown = ServerFailure(
  message: _serverDownMessage,
  code: HttpFailureCode.server,
);

/// Monta a página como a rota faz, com a "Ana Souza" na sessão e a Paulista
/// (São Paulo/SP) como primeira loja. A tela é alta para o formulário inteiro
/// caber sem rolar. Devolve os callbacks chamados, na ordem; `withOnSaved`
/// passa o `onSaved`, como a rota do checkout.
Future<List<String>> _pumpPage(
  WidgetTester tester,
  FakeCustomerRepository customers, {
  bool settle = true,
  bool withOnSaved = false,
}) async {
  tester.view.physicalSize = const Size(800, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final auth = FakeAuthRepository(currentUser: ana);
  addTearDown(auth.dispose);
  final stores = FakeStoreRepository(stores: const [paulista, rioBranco]);
  final backs = <String>[];
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light(),
      home: DeliveryDetailsPage(
        deliveryDetailsViewModelFactory: () => DeliveryDetailsViewModel(
          LoadDeliveryDetails(customers, stores),
          customers,
          auth,
        ),
        onBack: () => backs.add('back'),
        onSaved: withOnSaved ? () => backs.add('saved') : null,
      ),
    ),
  );
  settle ? await tester.pumpAndSettle() : await tester.pump();
  return backs;
}

Finder _input(String label) => find.descendant(
  of: find.widgetWithText(AppTextField, label),
  matching: find.byType(TextField),
);

String _textOf(WidgetTester tester, String label) =>
    tester.widget<TextField>(_input(label)).controller!.text;

Finder _button(String label) => find.widgetWithText(AppButton, label);

AppButton _buttonWidget(WidgetTester tester, String label) =>
    tester.widget<AppButton>(_button(label));

void main() {
  group('carga', () {
    testWidgets('mostra o skeleton enquanto o cadastro carrega', (
      tester,
    ) async {
      final customers = FakeCustomerRepository(mine: fortalezaCustomer);
      final hold = customers.holdFetch();
      await _pumpPage(tester, customers, settle: false);

      expect(find.text(DeliveryDetailsPage.title), findsOneWidget);
      expect(find.byType(SkeletonBox), findsWidgets);
      expect(find.byType(TextField), findsNothing);
      expect(_button(DeliveryDetailsPage.saveLabel), findsNothing);

      hold.complete(const Ok(fortalezaCustomer));
      await tester.pumpAndSettle();

      expect(find.byType(SkeletonBox), findsNothing);
      expect(_textOf(tester, PersonalDataFields.cpfLabel), '529.982.247-25');
    });

    testWidgets('falha mostra o banner e "Tentar de novo" volta ao skeleton '
        'e busca de novo', (tester) async {
      final customers = FakeCustomerRepository(mine: fortalezaCustomer)
        ..enqueueFetch(const Failure(_serverDown));
      await _pumpPage(tester, customers);

      expect(find.text(DeliveryDetailsPage.errorTitle), findsOneWidget);
      expect(find.text(_serverDownMessage), findsOneWidget);
      expect(find.byType(TextField), findsNothing);
      expect(_button(DeliveryDetailsPage.saveLabel), findsNothing);

      final hold = customers.holdFetch();
      await tester.tap(_button('Tentar de novo'));
      await tester.pump();

      expect(customers.fetchCalls, 2);
      expect(find.text(DeliveryDetailsPage.errorTitle), findsNothing);
      expect(find.byType(SkeletonBox), findsWidgets);

      hold.complete(const Ok(fortalezaCustomer));
      await tester.pumpAndSettle();

      expect(_textOf(tester, PersonalDataFields.cpfLabel), '529.982.247-25');
    });

    testWidgets('sem cadastro mostra o texto de apoio, o formulário vazio e '
        'a cidade/UF da loja', (tester) async {
      await _pumpPage(tester, FakeCustomerRepository());

      expect(find.text(DeliveryDetailsPage.newCustomerMessage), findsOneWidget);
      for (final label in [
        PersonalDataFields.cpfLabel,
        PersonalDataFields.phoneLabel,
        AddressFields.zipCodeLabel,
        AddressFields.streetLabel,
        AddressFields.numberLabel,
        AddressFields.complementLabel,
        AddressFields.neighborhoodLabel,
      ]) {
        expect(_textOf(tester, label), isEmpty, reason: label);
      }
      expect(_textOf(tester, AddressFields.cityLabel), 'São Paulo');
      expect(_textOf(tester, AddressFields.stateLabel), 'SP');
    });

    testWidgets('com cadastro mostra os valores mascarados, o nome e o '
        'e-mail da conta', (tester) async {
      await _pumpPage(tester, FakeCustomerRepository(mine: fortalezaCustomer));

      expect(find.text(DeliveryDetailsPage.newCustomerMessage), findsNothing);
      expect(find.text('Ana Souza'), findsOneWidget);
      expect(find.text('ana@exemplo.com'), findsOneWidget);
      expect(find.text(AccountDataCard.accountNote), findsOneWidget);
      expect(_textOf(tester, PersonalDataFields.cpfLabel), '529.982.247-25');
      expect(_textOf(tester, PersonalDataFields.phoneLabel), '(85) 99999-8888');
      expect(_textOf(tester, AddressFields.zipCodeLabel), '60150-160');
      expect(
        _textOf(tester, AddressFields.streetLabel),
        'Avenida Santos Dumont',
      );
      expect(_textOf(tester, AddressFields.numberLabel), '1500');
      expect(_textOf(tester, AddressFields.complementLabel), 'Sala 3');
      expect(_textOf(tester, AddressFields.neighborhoodLabel), 'Aldeota');
      expect(_textOf(tester, AddressFields.cityLabel), 'Fortaleza');
      expect(_textOf(tester, AddressFields.stateLabel), 'CE');
    });
  });

  group('rodapé', () {
    testWidgets('"Salvar dados" fica desabilitado sem alteração', (
      tester,
    ) async {
      await _pumpPage(tester, FakeCustomerRepository(mine: fortalezaCustomer));

      expect(
        _buttonWidget(tester, DeliveryDetailsPage.saveLabel).onPressed,
        isNull,
      );
      expect(_button(DeliveryDetailsPage.discardLabel), findsNothing);
    });

    testWidgets('editar mostra "Descartar alterações", que volta ao valor '
        'carregado', (tester) async {
      await _pumpPage(tester, FakeCustomerRepository(mine: fortalezaCustomer));

      await tester.enterText(
        _input(PersonalDataFields.phoneLabel),
        '85988887777',
      );
      await tester.pump();

      expect(_textOf(tester, PersonalDataFields.phoneLabel), '(85) 98888-7777');
      expect(_button(DeliveryDetailsPage.discardLabel), findsOneWidget);
      expect(
        _buttonWidget(tester, DeliveryDetailsPage.saveLabel).onPressed,
        isNotNull,
      );

      await tester.tap(_button(DeliveryDetailsPage.discardLabel));
      await tester.pump();

      expect(_textOf(tester, PersonalDataFields.phoneLabel), '(85) 99999-8888');
      expect(_button(DeliveryDetailsPage.discardLabel), findsNothing);
      expect(
        _buttonWidget(tester, DeliveryDetailsPage.saveLabel).onPressed,
        isNull,
      );
    });

    testWidgets('salvar mostra "Salvando…" e depois "Dados salvos", com o '
        'ponto do cadastro preservado', (tester) async {
      final customers = FakeCustomerRepository(mine: fortalezaCustomer);
      await _pumpPage(tester, customers);

      await tester.enterText(
        _input(PersonalDataFields.phoneLabel),
        '85988887777',
      );
      await tester.pump();
      final hold = customers.holdSave();
      await tester.tap(_button(DeliveryDetailsPage.saveLabel));
      await tester.pump();

      expect(_button(DeliveryDetailsPage.savingLabel), findsOneWidget);
      expect(
        _buttonWidget(tester, DeliveryDetailsPage.savingLabel).onPressed,
        isNull,
      );

      hold.complete(Ok(fortalezaCustomer.copyWith(phone: '85988887777')));
      await tester.pumpAndSettle();

      expect(customers.saveCalls.single.phone, '85988887777');
      expect(customers.saveCalls.single.location, fortalezaLocation);
      expect(find.text(DeliveryDetailsPage.savedMessage), findsOneWidget);
      expect(_textOf(tester, PersonalDataFields.phoneLabel), '(85) 98888-7777');
      expect(_button(DeliveryDetailsPage.discardLabel), findsNothing);
      expect(
        _buttonWidget(tester, DeliveryDetailsPage.saveLabel).onPressed,
        isNull,
      );
    });

    testWidgets('CPF inválido mostra o erro no campo sem chamar a API', (
      tester,
    ) async {
      final customers = FakeCustomerRepository(mine: fortalezaCustomer);
      await _pumpPage(tester, customers);

      await tester.enterText(
        _input(PersonalDataFields.cpfLabel),
        '529.982.247-24',
      );
      await tester.pump();
      await tester.tap(_button(DeliveryDetailsPage.saveLabel));
      await tester.pumpAndSettle();

      expect(customers.saveCalls, isEmpty);
      expect(
        find.descendant(
          of: find.widgetWithText(AppTextField, PersonalDataFields.cpfLabel),
          matching: find.text('CPF inválido.'),
        ),
        findsOneWidget,
      );
      expect(find.text(DeliveryDetailsPage.savedMessage), findsNothing);
    });

    testWidgets('servidor fora mostra a mensagem e mantém o que foi digitado', (
      tester,
    ) async {
      final customers = FakeCustomerRepository(mine: fortalezaCustomer)
        ..enqueueSave(const Failure<Customer>(_serverDown));
      await _pumpPage(tester, customers);

      await tester.enterText(_input(AddressFields.numberLabel), '1600');
      await tester.pump();
      await tester.tap(_button(DeliveryDetailsPage.saveLabel));
      await tester.pumpAndSettle();

      expect(find.text(_serverDownMessage), findsOneWidget);
      expect(_textOf(tester, AddressFields.numberLabel), '1600');
      expect(_button(DeliveryDetailsPage.discardLabel), findsOneWidget);
    });

    testWidgets('com "onSaved", salvar com sucesso o chama depois de "Dados '
        'salvos"', (tester) async {
      final customers = FakeCustomerRepository(mine: fortalezaCustomer);
      final calls = await _pumpPage(tester, customers, withOnSaved: true);

      await tester.enterText(_input(AddressFields.numberLabel), '1600');
      await tester.pump();
      await tester.tap(_button(DeliveryDetailsPage.saveLabel));
      await tester.pump();

      expect(find.text(DeliveryDetailsPage.savedMessage), findsOneWidget);
      expect(calls, ['saved']);
    });

    testWidgets('com "onSaved", a recusa não o chama', (tester) async {
      final customers = FakeCustomerRepository(mine: fortalezaCustomer)
        ..enqueueSave(const Failure<Customer>(_serverDown));
      final calls = await _pumpPage(tester, customers, withOnSaved: true);

      await tester.enterText(_input(AddressFields.numberLabel), '1600');
      await tester.pump();
      await tester.tap(_button(DeliveryDetailsPage.saveLabel));
      await tester.pumpAndSettle();

      expect(find.text(_serverDownMessage), findsOneWidget);
      expect(calls, isEmpty);
    });

    testWidgets('voltar chama o callback', (tester) async {
      final backs = await _pumpPage(
        tester,
        FakeCustomerRepository(mine: fortalezaCustomer),
      );

      await tester.tap(find.byType(BackButton));

      expect(backs, ['back']);
    });
  });
}
