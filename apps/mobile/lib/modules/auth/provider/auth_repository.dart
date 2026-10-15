import '../../../core/result.dart';
import '../../../core/value_objects/email.dart';
import '../../../core/value_objects/person_name.dart';
import '../../../core/value_objects/strong_password.dart';
import '../model/auth_user_entity.dart';

/// Acesso do cliente por e-mail e senha. Os value objects na assinatura
/// garantem que nada chega à API sem validar. As falhas de acesso levam os
/// códigos de `AuthErrorCode` (`errors/auth_errors.dart`).
abstract interface class AuthRepository {
  /// Usuário da sessão atual; `null` sem sessão ou enquanto ela é restaurada.
  AuthUser? get currentUser;

  /// Emite (broadcast) o usuário a cada entrada, saída ou expiração da sessão.
  Stream<AuthUser?> get userChanges;

  /// Entra e guarda a sessão. Credenciais recusadas viram
  /// `AuthErrorCode.invalidCredentials`; outra recusa, `signInFailed`.
  Future<Result<AuthUser>> signIn(Email email, StrongPassword password);

  /// Cria a conta e, aceito o registro, entra com as mesmas credenciais,
  /// devolvendo o resultado do login. E-mail já cadastrado vira
  /// `AuthErrorCode.emailAlreadyExists`; outra recusa, `signUpFailed`.
  Future<Result<AuthUser>> signUp(
    PersonName name,
    Email email,
    StrongPassword password,
  );

  /// Apaga a sessão guardada. Nunca falha.
  Future<void> signOut();
}
