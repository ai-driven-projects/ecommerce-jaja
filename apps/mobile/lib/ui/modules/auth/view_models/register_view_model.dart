import 'package:flutter/foundation.dart';

import '../../../../core/command.dart';
import '../../../../core/errors/app_failure.dart';
import '../../../../core/result.dart';
import '../../../../core/value_objects/email.dart';
import '../../../../core/value_objects/person_name.dart';
import '../../../../core/value_objects/strong_password.dart';
import '../../../../modules/auth/model/auth_user_entity.dart';
import '../../../../modules/auth/provider/auth_repository.dart';
import 'auth_form_messages.dart';

/// Formulário "Criar conta", no molde do [LoginViewModel]
/// (`register.schema.ts` do web). A confirmação compara dois campos, por isso
/// fica aqui e não num value object.
class RegisterViewModel extends ChangeNotifier {
  RegisterViewModel(this._repository) {
    submit = Command0<AuthUser>(_submit, onStateChange: notifyListeners);
  }

  static const passwordMismatchMessage = 'As senhas não conferem.';

  final AuthRepository _repository;

  /// Valida, cria a conta e entra; inválido devolve a `ValidationFailure` sem
  /// chamar a API.
  late final Command0<AuthUser> submit;

  String _name = '';
  String _email = '';
  String _password = '';
  String _confirmPassword = '';
  bool _attempted = false;

  String get name => _name;

  String get email => _email;

  String get password => _password;

  String get confirmPassword => _confirmPassword;

  String? get nameError =>
      _attempted ? validationMessage(PersonName.create(_name)) : null;

  String? get emailError =>
      _attempted ? validationMessage(Email.create(_email)) : null;

  String? get passwordError =>
      _attempted ? validationMessage(StrongPassword.create(_password)) : null;

  String? get confirmPasswordError =>
      _attempted && !_passwordsMatch ? passwordMismatchMessage : null;

  /// Mensagem do último envio que falhou, exceto validação.
  String? get formError => formErrorMessage(submit.result);

  bool get _passwordsMatch => _confirmPassword == _password;

  void updateName(String value) {
    _name = value;
    notifyListeners();
  }

  void updateEmail(String value) {
    _email = value;
    notifyListeners();
  }

  void updatePassword(String value) {
    _password = value;
    notifyListeners();
  }

  void updateConfirmPassword(String value) {
    _confirmPassword = value;
    notifyListeners();
  }

  Future<Result<AuthUser>> _submit() async {
    _attempted = true;
    final name = PersonName.create(_name);
    final email = Email.create(_email);
    final password = StrongPassword.create(_password);
    switch ((name, email, password)) {
      case (
            Ok(value: final name),
            Ok(value: final email),
            Ok(value: final password),
          )
          when _passwordsMatch:
        return _repository.signUp(name, email, password);
      case (Failure(:final failure), _, _) ||
          (_, Failure(:final failure), _) ||
          (_, _, Failure(:final failure)):
        return Failure(failure);
      default:
        return const Failure(
          ValidationFailure(
            message: passwordMismatchMessage,
            code: PasswordCode.mismatch,
          ),
        );
    }
  }
}
