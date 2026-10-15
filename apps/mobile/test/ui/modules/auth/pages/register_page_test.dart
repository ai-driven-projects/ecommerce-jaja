import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/modules/auth/errors/auth_errors.dart';
import 'package:mobile/ui/modules/auth/pages/register_page.dart';
import 'package:mobile/ui/modules/auth/view_models/register_view_model.dart';
import 'package:mobile/ui/shared/theme/app_theme.dart';
import 'package:mobile/ui/shared/widgets/app_button.dart';
import 'package:mobile/ui/shared/widgets/app_text_field.dart';

import '../../../../modules/auth/support/auth_fixtures.dart';
import '../../../../modules/auth/support/fake_auth_repository.dart';

final _emailAlreadyExists = BackendRejectionFailure(
  message: AuthErrorCode.emailAlreadyExists.message,
  code: AuthErrorCode.emailAlreadyExists,
  statusCode: 409,
  codes: const ['EMAIL_ALREADY_EXISTS'],
);

// Quatro campos com o contador do nome: o viewport cresce para o botão e o
// link ficarem à vista sem rolar.
const _surface = Size(800, 1400);

/// Monta a página como a rota faz; o callback "Já tenho conta" é gravado.
Future<List<String>> _pumpRegister(
  WidgetTester tester,
  FakeAuthRepository repository,
) async {
  tester.view.physicalSize = _surface;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(repository.dispose);

  final logins = <String>[];
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light(),
      home: RegisterPage(
        registerViewModelFactory: () => RegisterViewModel(repository),
        onClose: () {},
        onOpenLogin: () => logins.add('login'),
      ),
    ),
  );
  return logins;
}

Finder _input(String label) => find.descendant(
  of: find.widgetWithText(AppTextField, label),
  matching: find.byType(TextField),
);

Future<void> _fill(
  WidgetTester tester, {
  String confirmPassword = '#Senha123',
}) async {
  await tester.enterText(_input(RegisterPage.nameLabel), ' Ana Souza ');
  await tester.enterText(_input(RegisterPage.emailLabel), 'ana@exemplo.com');
  await tester.enterText(_input(RegisterPage.passwordLabel), '#Senha123');
  await tester.enterText(
    _input(RegisterPage.confirmPasswordLabel),
    confirmPassword,
  );
}

Future<void> _submit(WidgetTester tester) async {
  await tester.tap(find.widgetWithText(AppButton, RegisterPage.submitLabel));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('mostra os quatro campos, com o nome limitado a 50', (
    tester,
  ) async {
    await _pumpRegister(tester, FakeAuthRepository());

    expect(find.byType(AppTextField), findsNWidgets(4));
    for (final label in ['Nome', 'E-mail', 'Senha', 'Confirmar senha']) {
      expect(_input(label), findsOneWidget);
    }
    expect(find.text('Nome e sobrenome'), findsOneWidget);
    expect(tester.widget<TextField>(_input('Nome')).maxLength, 50);
    expect(tester.widget<TextField>(_input('Senha')).obscureText, isTrue);
    expect(
      tester.widget<TextField>(_input('Confirmar senha')).obscureText,
      isTrue,
    );
    expect(
      find.widgetWithText(AppButton, RegisterPage.submitLabel),
      findsOneWidget,
    );
    expect(find.widgetWithText(TextButton, 'Já tenho conta'), findsOneWidget);
  });

  testWidgets('confirmação diferente mostra "As senhas não conferem."', (
    tester,
  ) async {
    final repository = FakeAuthRepository();
    await _pumpRegister(tester, repository);
    await _fill(tester, confirmPassword: '#Senha124');

    await _submit(tester);

    expect(find.text('As senhas não conferem.'), findsOneWidget);
    expect(repository.signUpCalls, isEmpty);
  });

  testWidgets('enquanto cria, mostra "Criando conta…" com o botão inativo', (
    tester,
  ) async {
    final repository = FakeAuthRepository();
    final pending = repository.holdSignUp();
    await _pumpRegister(tester, repository);
    await _fill(tester);

    await tester.tap(find.widgetWithText(AppButton, RegisterPage.submitLabel));
    await tester.pump();

    final button = tester.widget<AppButton>(
      find.widgetWithText(AppButton, RegisterPage.submittingLabel),
    );
    expect(button.onPressed, isNull);

    pending.complete(Failure(_emailAlreadyExists));
    await tester.pumpAndSettle();
  });

  testWidgets('e-mail já cadastrado mostra a mensagem no formulário', (
    tester,
  ) async {
    final repository = FakeAuthRepository()
      ..enqueueSignUp(Failure(_emailAlreadyExists));
    await _pumpRegister(tester, repository);
    await _fill(tester);

    await _submit(tester);

    expect(find.text('Este e-mail já está cadastrado.'), findsOneWidget);
    expect(repository.currentUser, isNull);
    expect(find.byType(SnackBar), findsNothing);
  });

  testWidgets('no sucesso mostra "Conta criada. Bem-vindo, Ana"', (
    tester,
  ) async {
    final repository = FakeAuthRepository();
    await _pumpRegister(tester, repository);
    await _fill(tester);

    await _submit(tester);

    expect(find.text('Conta criada. Bem-vindo, Ana'), findsOneWidget);
    expect(repository.currentUser, ana);
    expect(repository.signUpCalls.single.name.value, 'Ana Souza');
  });

  testWidgets('"Já tenho conta" chama o callback', (tester) async {
    final logins = await _pumpRegister(tester, FakeAuthRepository());

    await tester.tap(find.widgetWithText(TextButton, 'Já tenho conta'));

    expect(logins, hasLength(1));
  });
}
