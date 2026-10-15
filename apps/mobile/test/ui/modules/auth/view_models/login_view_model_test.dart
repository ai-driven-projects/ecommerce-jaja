import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/modules/auth/errors/auth_errors.dart';
import 'package:mobile/ui/modules/auth/view_models/login_view_model.dart';

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

void main() {
  late FakeAuthRepository repository;
  late LoginViewModel viewModel;

  setUp(() {
    repository = FakeAuthRepository();
    viewModel = LoginViewModel(repository);
  });

  tearDown(() {
    viewModel.dispose();
    repository.dispose();
  });

  void fill({required String email, required String password}) {
    viewModel
      ..updateEmail(email)
      ..updatePassword(password);
  }

  test('sem tentativa não há erro de campo nem de formulário', () {
    fill(email: 'ana@', password: '123');

    expect(viewModel.emailError, isNull);
    expect(viewModel.passwordError, isNull);
    expect(viewModel.formError, isNull);
  });

  test('cada mudança de campo avisa os ouvintes', () {
    var notifications = 0;
    viewModel.addListener(() => notifications++);

    fill(email: 'ana@exemplo.com', password: '#Senha123');

    expect(viewModel.email, 'ana@exemplo.com');
    expect(viewModel.password, '#Senha123');
    expect(notifications, 2);
  });

  test('enviar inválido mostra os dois erros e não chama signIn', () async {
    fill(email: 'ana@', password: '123');

    await viewModel.submit.execute();

    expect(viewModel.emailError, 'E-mail inválido.');
    expect(viewModel.passwordError, _strongPasswordMessage);
    expect(viewModel.submit.result, isA<Failure<Object>>());
    expect(repository.signInCalls, isEmpty);
  });

  test('corrigir o campo depois da tentativa apaga o erro dele', () async {
    fill(email: 'ana@', password: '123');
    await viewModel.submit.execute();

    viewModel.updateEmail('ana@exemplo.com');

    expect(viewModel.emailError, isNull);
    expect(viewModel.passwordError, _strongPasswordMessage);

    viewModel.updatePassword('#Senha123');

    expect(viewModel.passwordError, isNull);
  });

  test('válido chama signIn com o e-mail normalizado', () async {
    fill(email: ' Ana@Exemplo.COM ', password: '#Senha123');

    await viewModel.submit.execute();

    expect(repository.signInCalls, hasLength(1));
    expect(repository.signInCalls.single.email.value, 'ana@exemplo.com');
    expect(repository.signInCalls.single.password.value, '#Senha123');
    expect(viewModel.submit.result, isA<Ok<Object>>());
    expect((viewModel.submit.result! as Ok).value, ana);
    expect(viewModel.formError, isNull);
  });

  test('roda enquanto o signIn não responde', () async {
    fill(email: 'ana@exemplo.com', password: '#Senha123');
    final gate = repository.holdSignIn();

    final submitting = viewModel.submit.execute();
    expect(viewModel.submit.running, isTrue);

    gate.complete(const Ok(ana));
    await submitting;

    expect(viewModel.submit.running, isFalse);
  });

  test('falha de credencial preenche formError', () async {
    repository.enqueueSignIn(Failure(_invalidCredentials));
    fill(email: 'ana@exemplo.com', password: '#Senha123');

    await viewModel.submit.execute();

    expect(viewModel.formError, 'E-mail ou senha inválidos.');
    expect(viewModel.emailError, isNull);
    expect(viewModel.passwordError, isNull);
  });

  test('ValidationFailure não vai para formError', () async {
    repository.enqueueSignIn(Failure(_invalidCredentials));
    fill(email: 'ana@exemplo.com', password: '#Senha123');
    await viewModel.submit.execute();

    viewModel.updateEmail('ana@');
    await viewModel.submit.execute();

    expect(viewModel.submit.result, isA<Failure<Object>>());
    expect(
      (viewModel.submit.result! as Failure).failure,
      isA<ValidationFailure>(),
    );
    expect(viewModel.formError, isNull);
    expect(viewModel.emailError, 'E-mail inválido.');
  });
}
