import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/modules/auth/errors/auth_errors.dart';
import 'package:mobile/ui/modules/auth/pages/login_page.dart';
import 'package:mobile/ui/modules/auth/view_models/login_view_model.dart';
import 'package:mobile/ui/shared/theme/app_theme.dart';
import 'package:mobile/ui/shared/widgets/app_button.dart';
import 'package:mobile/ui/shared/widgets/app_text_field.dart';

import '../../../../modules/auth/support/auth_fixtures.dart';
import '../../../../modules/auth/support/fake_auth_repository.dart';

const _strongPasswordMessage =
    'A senha precisa ter ao menos 8 caracteres, com maiúscula, minúscula, '
    'número e símbolo.';

final _invalidCredentials = BackendRejectionFailure(
  message: AuthErrorCode.invalidCredentials.message,
  code: AuthErrorCode.invalidCredentials,
  statusCode: 401,
  codes: const ['INVALID_CREDENTIALS'],
);

typedef _Calls = ({List<String> closes, List<String> registers});

/// Monta a página como a rota faz: a fábrica cria o ViewModel de verdade
/// sobre o repositório fake; os callbacks só são gravados.
Future<_Calls> _pumpLogin(
  WidgetTester tester,
  FakeAuthRepository repository,
) async {
  final calls = (closes: <String>[], registers: <String>[]);
  addTearDown(repository.dispose);
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light(),
      home: LoginPage(
        loginViewModelFactory: () => LoginViewModel(repository),
        onClose: () => calls.closes.add('close'),
        onOpenRegister: () => calls.registers.add('register'),
      ),
    ),
  );
  return calls;
}

Finder _field(String label) => find.widgetWithText(AppTextField, label);

Future<void> _fill(WidgetTester tester) async {
  await tester.enterText(
    find.descendant(
      of: _field(LoginPage.emailLabel),
      matching: find.byType(TextField),
    ),
    'ana@exemplo.com',
  );
  await tester.enterText(
    find.descendant(
      of: _field(LoginPage.passwordLabel),
      matching: find.byType(TextField),
    ),
    '#Senha123',
  );
}

Finder get _submitButton => find.widgetWithText(AppButton, 'Entrar');

void main() {
  testWidgets('mostra o título, os campos e o botão', (tester) async {
    await _pumpLogin(tester, FakeAuthRepository());

    expect(find.text(LoginPage.title), findsWidgets);
    expect(_field('E-mail'), findsOneWidget);
    expect(_field('Senha'), findsOneWidget);
    expect(find.text('voce@empresa.com'), findsOneWidget);
    final password = tester.widget<TextField>(
      find.descendant(of: _field('Senha'), matching: find.byType(TextField)),
    );
    expect(password.obscureText, isTrue);
    expect(_submitButton, findsOneWidget);
    expect(find.widgetWithText(TextButton, 'Criar conta'), findsOneWidget);
    expect(find.byType(CloseButton), findsOneWidget);
  });

  testWidgets('tocar "Entrar" vazio mostra as mensagens e não chama a API', (
    tester,
  ) async {
    final repository = FakeAuthRepository();
    await _pumpLogin(tester, repository);

    await tester.tap(_submitButton);
    await tester.pump();

    expect(find.text('E-mail inválido.'), findsOneWidget);
    expect(find.text(_strongPasswordMessage), findsOneWidget);
    expect(repository.signInCalls, isEmpty);
  });

  testWidgets('enquanto entra, mostra "Entrando…" com o botão inativo', (
    tester,
  ) async {
    final repository = FakeAuthRepository();
    final pending = repository.holdSignIn();
    await _pumpLogin(tester, repository);
    await _fill(tester);

    await tester.tap(_submitButton);
    await tester.pump();

    final button = tester.widget<AppButton>(
      find.widgetWithText(AppButton, LoginPage.submittingLabel),
    );
    expect(button.onPressed, isNull);
    expect(repository.signInCalls, hasLength(1));

    pending.complete(Failure(_invalidCredentials));
    await tester.pumpAndSettle();
  });

  testWidgets('credenciais recusadas mostram "E-mail ou senha inválidos."', (
    tester,
  ) async {
    final repository = FakeAuthRepository()
      ..enqueueSignIn(Failure(_invalidCredentials));
    await _pumpLogin(tester, repository);
    await _fill(tester);

    await tester.tap(_submitButton);
    await tester.pumpAndSettle();

    expect(find.text('E-mail ou senha inválidos.'), findsOneWidget);
    expect(find.byType(SnackBar), findsNothing);
  });

  testWidgets('no sucesso mostra "Bem-vindo, Ana"', (tester) async {
    final repository = FakeAuthRepository();
    await _pumpLogin(tester, repository);
    await _fill(tester);

    await tester.tap(_submitButton);
    await tester.pumpAndSettle();

    expect(find.text('Bem-vindo, Ana'), findsOneWidget);
    expect(repository.currentUser, ana);
    expect(repository.signInCalls.single.email.value, 'ana@exemplo.com');
  });

  testWidgets('fechar e "Criar conta" chamam os callbacks', (tester) async {
    final calls = await _pumpLogin(tester, FakeAuthRepository());

    await tester.tap(find.byType(CloseButton));
    await tester.tap(find.widgetWithText(TextButton, 'Criar conta'));

    expect(calls.closes, hasLength(1));
    expect(calls.registers, hasLength(1));
  });
}
