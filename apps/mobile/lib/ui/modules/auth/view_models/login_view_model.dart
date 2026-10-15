import 'package:flutter/foundation.dart';

import '../../../../core/command.dart';
import '../../../../core/result.dart';
import '../../../../core/value_objects/email.dart';
import '../../../../core/value_objects/strong_password.dart';
import '../../../../modules/auth/model/auth_user_entity.dart';
import '../../../../modules/auth/provider/auth_repository.dart';
import 'auth_form_messages.dart';

/// Formulário "Entrar". Os erros de campo só aparecem depois da primeira
/// tentativa e são recalculados a cada mudança, como o `reValidateMode` do
/// formulário web (`login.schema.ts`, que também exige senha forte).
class LoginViewModel extends ChangeNotifier {
  LoginViewModel(this._repository) {
    submit = Command0<AuthUser>(_submit, onStateChange: notifyListeners);
  }

  final AuthRepository _repository;

  /// Valida e entra; inválido devolve a `ValidationFailure` sem chamar a API.
  late final Command0<AuthUser> submit;

  String _email = '';
  String _password = '';
  bool _attempted = false;

  String get email => _email;

  String get password => _password;

  String? get emailError =>
      _attempted ? validationMessage(Email.create(_email)) : null;

  String? get passwordError =>
      _attempted ? validationMessage(StrongPassword.create(_password)) : null;

  /// Mensagem do último envio que falhou, exceto validação (que fica nos
  /// campos).
  String? get formError => formErrorMessage(submit.result);

  void updateEmail(String value) {
    _email = value;
    notifyListeners();
  }

  void updatePassword(String value) {
    _password = value;
    notifyListeners();
  }

  Future<Result<AuthUser>> _submit() async {
    _attempted = true;
    final email = Email.create(_email);
    final password = StrongPassword.create(_password);
    return switch ((email, password)) {
      (Ok(value: final email), Ok(value: final password)) => _repository.signIn(
        email,
        password,
      ),
      (Failure(:final failure), _) ||
      (_, Failure(:final failure)) => Failure(failure),
    };
  }
}
