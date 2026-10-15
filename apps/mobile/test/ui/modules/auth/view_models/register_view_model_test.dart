import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/modules/auth/errors/auth_errors.dart';
import 'package:mobile/ui/modules/auth/view_models/register_view_model.dart';

import '../../../../modules/auth/support/auth_fixtures.dart';
import '../../../../modules/auth/support/fake_auth_repository.dart';

void main() {
  late FakeAuthRepository repository;
  late RegisterViewModel viewModel;

  setUp(() {
    repository = FakeAuthRepository();
    viewModel = RegisterViewModel(repository);
  });

  tearDown(() {
    viewModel.dispose();
    repository.dispose();
  });

  void fill({
    String name = 'Ana Souza',
    String email = 'ana@exemplo.com',
    String password = '#Senha123',
    String confirmPassword = '#Senha123',
  }) {
    viewModel
      ..updateName(name)
      ..updateEmail(email)
      ..updatePassword(password)
      ..updateConfirmPassword(confirmPassword);
  }

  test('sem tentativa não há erro de campo nem de formulário', () {
    fill(name: 'Ana', email: 'ana@', password: '123', confirmPassword: '1');

    expect(viewModel.nameError, isNull);
    expect(viewModel.emailError, isNull);
    expect(viewModel.passwordError, isNull);
    expect(viewModel.confirmPasswordError, isNull);
    expect(viewModel.formError, isNull);
  });

  test(
    'enviar inválido mostra o erro de cada campo e não chama signUp',
    () async {
      fill(name: 'Ana', email: 'ana@', password: '123', confirmPassword: '1');

      await viewModel.submit.execute();

      expect(viewModel.nameError, 'Informe nome e sobrenome.');
      expect(viewModel.emailError, 'E-mail inválido.');
      expect(viewModel.passwordError, isNotNull);
      expect(viewModel.confirmPasswordError, 'As senhas não conferem.');
      expect(viewModel.formError, isNull);
      expect(repository.signUpCalls, isEmpty);
    },
  );

  test('confirmação diferente mostra "As senhas não conferem." sem '
      'chamada', () async {
    fill(confirmPassword: '#Senha124');

    await viewModel.submit.execute();

    expect(viewModel.confirmPasswordError, 'As senhas não conferem.');
    expect(viewModel.nameError, isNull);
    expect(viewModel.emailError, isNull);
    expect(viewModel.passwordError, isNull);
    expect(
      (viewModel.submit.result! as Failure).failure,
      isA<ValidationFailure>(),
    );
    expect(viewModel.formError, isNull);
    expect(repository.signUpCalls, isEmpty);

    viewModel.updateConfirmPassword('#Senha123');

    expect(viewModel.confirmPasswordError, isNull);
  });

  test('válido chama signUp com nome aparado e e-mail normalizado', () async {
    fill(name: '  Ana Souza  ', email: ' Ana@Exemplo.COM ');

    await viewModel.submit.execute();

    expect(repository.signUpCalls, hasLength(1));
    final call = repository.signUpCalls.single;
    expect(call.name.value, 'Ana Souza');
    expect(call.email.value, 'ana@exemplo.com');
    expect(call.password.value, '#Senha123');
    expect((viewModel.submit.result! as Ok).value, ana);
    expect(viewModel.formError, isNull);
  });

  test('emailAlreadyExists vai para formError', () async {
    repository.enqueueSignUp(
      Failure(
        BackendRejectionFailure(
          message: AuthErrorCode.emailAlreadyExists.message,
          code: AuthErrorCode.emailAlreadyExists,
          statusCode: 409,
          codes: const ['EMAIL_ALREADY_EXISTS'],
        ),
      ),
    );
    fill();

    await viewModel.submit.execute();

    expect(viewModel.formError, 'Este e-mail já está cadastrado.');
    expect(viewModel.emailError, isNull);
  });
}
