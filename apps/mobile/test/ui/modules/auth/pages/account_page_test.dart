import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/modules/auth/model/auth_user_entity.dart';
import 'package:mobile/ui/modules/auth/pages/account_page.dart';
import 'package:mobile/ui/modules/auth/view_models/account_view_model.dart';
import 'package:mobile/ui/shared/theme/app_theme.dart';
import 'package:mobile/ui/shared/widgets/app_button.dart';

import '../../../../modules/auth/support/auth_fixtures.dart';
import '../../../../modules/auth/support/fake_auth_repository.dart';

typedef _Calls = ({List<String> logins, List<String> registers});

/// Monta a página como a rota faz: a fábrica cria o ViewModel de verdade
/// sobre o repositório fake, que começa com [currentUser].
Future<({FakeAuthRepository repository, _Calls calls})> _pumpAccount(
  WidgetTester tester, {
  AuthUser? currentUser,
}) async {
  final repository = FakeAuthRepository(currentUser: currentUser);
  addTearDown(repository.dispose);
  final calls = (logins: <String>[], registers: <String>[]);
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light(),
      home: AccountPage(
        accountViewModelFactory: () => AccountViewModel(repository),
        onOpenLogin: () => calls.logins.add('login'),
        onOpenRegister: () => calls.registers.add('register'),
      ),
    ),
  );
  return (repository: repository, calls: calls);
}

Finder _button(String label) => find.widgetWithText(AppButton, label);

void _expectInvite() {
  expect(find.text('Entre ou crie sua conta.'), findsOneWidget);
  expect(
    find.text(
      'Uma conta para todo o escritório pedir o que falta e acompanhar a '
      'bike chegando.',
    ),
    findsOneWidget,
  );
  for (final benefit in [
    'Entrega de bike em minutos',
    'Endereço e andar salvos',
    'Histórico de pedidos do escritório',
  ]) {
    expect(find.text(benefit), findsOneWidget);
  }
  expect(find.text('✓'), findsNWidgets(3));
  expect(_button('Entrar'), findsOneWidget);
  expect(_button('Criar conta'), findsOneWidget);
  expect(_button('Sair'), findsNothing);
}

void main() {
  testWidgets('sem sessão mostra o convite e as ações chamam os callbacks', (
    tester,
  ) async {
    final (:repository, :calls) = await _pumpAccount(tester);

    _expectInvite();
    final login = tester.widget<AppButton>(_button('Entrar'));
    final register = tester.widget<AppButton>(_button('Criar conta'));
    expect(login.variant, AppButtonVariant.primary);
    expect(register.variant, AppButtonVariant.secondary);

    await tester.tap(_button('Entrar'));
    await tester.tap(_button('Criar conta'));

    expect(calls.logins, hasLength(1));
    expect(calls.registers, hasLength(1));
    expect(repository.signOutCalls, 0);
  });

  testWidgets('com sessão mostra a saudação, o nome, o e-mail e "Sair"', (
    tester,
  ) async {
    await _pumpAccount(tester, currentUser: ana);

    expect(find.text('Olá, Ana'), findsOneWidget);
    expect(find.text('Ana Souza'), findsOneWidget);
    expect(find.text('ana@exemplo.com'), findsOneWidget);
    expect(_button('Sair'), findsOneWidget);
    expect(find.text('Administrador'), findsNothing);
    expect(find.text('Entre ou crie sua conta.'), findsNothing);
  });

  testWidgets('administrador vê "Administrador" no lugar do e-mail', (
    tester,
  ) async {
    await _pumpAccount(tester, currentUser: admin);

    expect(find.text('Olá, Bruno'), findsOneWidget);
    expect(find.text('Bruno Lima'), findsOneWidget);
    expect(find.text('Administrador'), findsOneWidget);
    expect(find.text('admin@jaja.com.br'), findsNothing);
  });

  testWidgets('"Sair" mostra "Até já já." e volta ao convite', (tester) async {
    final (:repository, calls: _) = await _pumpAccount(
      tester,
      currentUser: ana,
    );

    await tester.tap(_button('Sair'));
    await tester.pumpAndSettle();

    expect(repository.signOutCalls, 1);
    expect(find.text('Até já já.'), findsOneWidget);
    _expectInvite();
  });

  testWidgets('troca de estado quando a sessão começa ou termina por fora', (
    tester,
  ) async {
    final (:repository, calls: _) = await _pumpAccount(tester);

    repository.emit(ana);
    await tester.pumpAndSettle();
    expect(find.text('Olá, Ana'), findsOneWidget);

    repository.emit(null);
    await tester.pumpAndSettle();
    _expectInvite();
    expect(find.text('Até já já.'), findsNothing);
  });
}
